#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BUMP_TYPES = new Set(["patch", "minor", "major"]);
const PACKAGE_CONFIGS = [
  {
    key: "mcp",
    manifestPath: "mcp/package.json",
    trackedDirs: ["mcp"],
  },
  {
    key: "dashboard/backend",
    manifestPath: "dashboard/backend/package.json",
    trackedDirs: ["dashboard/backend"],
  },
  {
    key: "dashboard/frontend",
    manifestPath: "dashboard/frontend/package.json",
    trackedDirs: ["dashboard/frontend"],
  },
];

const HASH_STATE_VERSION = 1;

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const HASH_STATE_PATH = path.join(ROOT_DIR, ".bump-hashes.json");

const IGNORED_PATHS = [/\.tsbuildinfo$/, /\/dist\//, /\/node_modules\//];
const IGNORED_DIRECTORY_NAMES = new Set(["dist", "node_modules", ".git", "coverage", "__pycache__", ".pytest_cache"]);

function printUsage() {
  console.log(
    `
Usage:
  npm run bump
  npm run bump -- --force <patch|minor|major>
  npm run bump -- <patch|minor|major>
  npm run bump -- --since <git-ref>
  npm run bump -- --dry-run

Behavior:
  - Hashes files in mcp/, dashboard/backend/, and dashboard/frontend/
  - Bumps changed packages using semantic versioning
  - Root package.json uses date versions: yyyy.mm.dd, then yyyy-mm-dd-<build#>

Examples:
  npm run bump
  npm run bump -- --force patch
  npm run bump -- major --dry-run
  npm run bump -- --since origin/main
`.trim()
  );
}

function fail(message) {
  console.error(`❌ Error: ${message}`);
  process.exit(1);
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function relFromRoot(absPath) {
  return toPosix(path.relative(ROOT_DIR, absPath));
}

function readJson(absPath) {
  return JSON.parse(readFileSync(absPath, "utf8"));
}

function writeJson(absPath, data) {
  writeFileSync(absPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function runGit(args, { allowFailure = false } = {}) {
  try {
    return execFileSync("git", args, {
      cwd: ROOT_DIR,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    if (allowFailure) {
      return "";
    }

    const details = error.stderr?.toString().trim();
    fail(`git ${args.join(" ")} failed${details ? `: ${details}` : "."}`);
  }
}

function gitLines(args, options = {}) {
  const output = runGit(args, options);
  if (!output) {
    return [];
  }

  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseArgs(args) {
  const parsed = {
    force: null,
    since: null,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }

    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }

    if (arg === "--force") {
      const forceValue = args[i + 1];
      if (!forceValue) {
        fail("Missing bump type after --force.");
      }

      parsed.force = forceValue;
      i += 1;
      continue;
    }

    if (arg.startsWith("--force=")) {
      parsed.force = arg.split("=")[1];
      continue;
    }

    if (arg === "--since") {
      const sinceValue = args[i + 1];
      if (!sinceValue) {
        fail("Missing git ref after --since.");
      }

      parsed.since = sinceValue;
      i += 1;
      continue;
    }

    if (arg.startsWith("--since=")) {
      parsed.since = arg.split("=")[1];
      continue;
    }

    if (BUMP_TYPES.has(arg)) {
      parsed.force = arg;
      continue;
    }

    fail(`Unknown argument "${arg}". Run with --help for usage.`);
  }

  if (parsed.force && !BUMP_TYPES.has(parsed.force)) {
    fail(`Invalid force bump "${parsed.force}". Expected patch|minor|major.`);
  }

  return parsed;
}

function hasHeadCommit() {
  return Boolean(runGit(["rev-parse", "--verify", "--quiet", "HEAD"], { allowFailure: true }));
}

function isIgnoredPath(filePath) {
  return IGNORED_PATHS.some((pattern) => pattern.test(filePath));
}

function isIgnoredDirectory(dirName) {
  return IGNORED_DIRECTORY_NAMES.has(dirName);
}

function loadPackageManifests() {
  return PACKAGE_CONFIGS.map((config) => {
    const manifestPathAbs = path.join(ROOT_DIR, config.manifestPath);
    const manifest = readJson(manifestPathAbs);

    if (!manifest.name) {
      fail(`Package manifest ${config.manifestPath} is missing a name.`);
    }

    if (!manifest.version || !/^\d+\.\d+\.\d+(?:[-+].+)?$/.test(manifest.version)) {
      fail(`Package manifest ${config.manifestPath} must use semantic versioning. Current: ${manifest.version}`);
    }

    return {
      key: config.key,
      name: manifest.name,
      manifestPath: config.manifestPath,
      manifestPathAbs,
      manifest,
      trackedDirs: config.trackedDirs,
    };
  });
}

function buildDependencyGraph(packages) {
  const byName = new Map();
  const dependentsByKey = new Map();

  for (const pkg of packages) {
    byName.set(pkg.name, pkg.key);
  }

  for (const pkg of packages) {
    const deps = new Set();

    for (const depField of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
      const entries = pkg.manifest[depField];
      if (!entries || typeof entries !== "object") {
        continue;
      }

      for (const depName of Object.keys(entries)) {
        const depKey = byName.get(depName);
        if (!depKey) {
          continue;
        }

        deps.add(depKey);

        if (!dependentsByKey.has(depKey)) {
          dependentsByKey.set(depKey, new Set());
        }

        dependentsByKey.get(depKey).add(pkg.key);
      }
    }
  }

  for (const pkg of packages) {
    if (!dependentsByKey.has(pkg.key)) {
      dependentsByKey.set(pkg.key, new Set());
    }
  }

  return { byName, dependentsByKey };
}

function collectChangedFilesSinceGitRef(sinceRef, trackedPaths) {
  const changedFiles = new Set();
  const addFiles = (files) => {
    for (const file of files) {
      changedFiles.add(file);
    }
  };

  if (sinceRef) {
    if (!hasHeadCommit()) {
      fail(`Cannot use --since ${sinceRef} because this repository has no commits yet.`);
    }

    const refExists = Boolean(runGit(["rev-parse", "--verify", "--quiet", sinceRef], { allowFailure: true }));
    if (!refExists) {
      fail(`Git ref "${sinceRef}" does not exist.`);
    }

    addFiles(gitLines(["diff", "--name-only", `${sinceRef}...HEAD`, "--", ...trackedPaths], { allowFailure: true }));
    addFiles(gitLines(["diff", "--name-only", "HEAD", "--", ...trackedPaths], { allowFailure: true }));
    addFiles(gitLines(["ls-files", "--others", "--exclude-standard", "--", ...trackedPaths], { allowFailure: true }));
    return [...changedFiles].filter((file) => !isIgnoredPath(file));
  }

  if (hasHeadCommit()) {
    const latestTag = runGit(["describe", "--tags", "--abbrev=0"], { allowFailure: true });

    if (latestTag) {
      addFiles(gitLines(["diff", "--name-only", `${latestTag}..HEAD`, "--", ...trackedPaths], { allowFailure: true }));
    } else {
      addFiles(gitLines(["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD", "--", ...trackedPaths], { allowFailure: true }));
    }

    addFiles(gitLines(["diff", "--name-only", "HEAD", "--", ...trackedPaths], { allowFailure: true }));
    addFiles(gitLines(["ls-files", "--others", "--exclude-standard", "--", ...trackedPaths], { allowFailure: true }));
    return [...changedFiles].filter((file) => !isIgnoredPath(file));
  }

  addFiles(gitLines(["ls-files", "--cached", "--others", "--exclude-standard", "--", ...trackedPaths], { allowFailure: true }));
  return [...changedFiles].filter((file) => !isIgnoredPath(file));
}

function walkPackageFiles(directories) {
  const files = [];
  const allDirs = Array.isArray(directories) ? directories : [directories];

  for (const directory of allDirs) {
    const absDir = path.join(ROOT_DIR, directory);
    if (!existsSync(absDir) || !statSync(absDir).isDirectory()) {
      continue;
    }

    const stack = [absDir];

    while (stack.length > 0) {
      const currentDir = stack.pop();
      const entries = readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const absPath = path.join(currentDir, entry.name);
        const relPath = relFromRoot(absPath);

        if (entry.isDirectory()) {
          if (isIgnoredDirectory(entry.name)) {
            continue;
          }

          stack.push(absPath);
          continue;
        }

        if (!entry.isFile()) {
          continue;
        }

        if (isIgnoredPath(relPath)) {
          continue;
        }

        files.push(absPath);
      }
    }
  }

  files.sort((a, b) => relFromRoot(a).localeCompare(relFromRoot(b)));
  return files;
}

function hashValue(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hashFile(absPath) {
  return hashValue(readFileSync(absPath));
}

function hashFileMap(fileMap) {
  const lines = Object.entries(fileMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([filePath, digest]) => `${filePath}:${digest}`)
    .join("\n");

  return hashValue(lines);
}

function computePackageSnapshot(packages) {
  const result = {};

  for (const pkg of packages) {
    const files = walkPackageFiles(pkg.trackedDirs);
    const fileHashes = {};

    for (const absPath of files) {
      fileHashes[relFromRoot(absPath)] = hashFile(absPath);
    }

    result[pkg.key] = {
      name: pkg.name,
      hash: hashFileMap(fileHashes),
      files: fileHashes,
    };
  }

  return result;
}

function loadHashState() {
  if (!existsSync(HASH_STATE_PATH)) {
    return null;
  }

  try {
    const parsed = readJson(HASH_STATE_PATH);

    if (typeof parsed !== "object" || parsed === null || typeof parsed.packages !== "object" || parsed.packages === null) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function detectHashChanges(currentSnapshot, previousState) {
  const changedKeys = new Set();

  for (const [packageKey, currentPackage] of Object.entries(currentSnapshot)) {
    const previousPackage = previousState?.packages?.[packageKey];

    if (!previousPackage || previousPackage.hash !== currentPackage.hash) {
      changedKeys.add(packageKey);
    }
  }

  return changedKeys;
}

function bumpSemver(version, type) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].+)?$/);
  if (!match) {
    fail(`Cannot ${type} bump non-semver version "${version}".`);
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);

  if (type === "patch") {
    return `${major}.${minor}.${patch + 1}`;
  }

  if (type === "minor") {
    return `${major}.${minor + 1}.0`;
  }

  if (type === "major") {
    return `${major + 1}.0.0`;
  }

  fail(`Unsupported bump type "${type}".`);
}

function updateDependencySpecifier(currentSpecifier, newVersion) {
  if (typeof currentSpecifier !== "string") {
    return currentSpecifier;
  }

  if (currentSpecifier.startsWith("workspace:")) {
    const tail = currentSpecifier.slice("workspace:".length);

    if (tail === "*" || tail === "^" || tail === "~") {
      return currentSpecifier;
    }

    if (tail.startsWith("^")) {
      return `workspace:^${newVersion}`;
    }

    if (tail.startsWith("~")) {
      return `workspace:~${newVersion}`;
    }

    return `workspace:${newVersion}`;
  }

  if (currentSpecifier.startsWith("^")) {
    return `^${newVersion}`;
  }

  if (currentSpecifier.startsWith("~")) {
    return `~${newVersion}`;
  }

  if (/^\d+\.\d+\.\d+(?:[-+].+)?$/.test(currentSpecifier)) {
    return newVersion;
  }

  return currentSpecifier;
}

function getTodayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function updateChangelog(changelogPath, newVersion) {
  if (!existsSync(changelogPath)) {
    return false;
  }

  let content = readFileSync(changelogPath, "utf8");

  // Look for the [Unreleased] section
  const unreleasedPattern = /^## \[Unreleased\]\n/m;
  if (!unreleasedPattern.test(content)) {
    return false;
  }

  const today = getTodayDate();
  const versionHeader = `## [${newVersion}] - ${today}`;

  // Keep [Unreleased] at top as empty section, insert versioned header after separator
  content = content.replace(unreleasedPattern, `## [Unreleased]\n\n---\n\n${versionHeader}\n`);

  writeFileSync(changelogPath, content, "utf8");
  return true;
}

function updateLocalDependencies(packages, bumpedByKey) {
  for (const pkg of packages) {
    let changed = false;

    for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
      const depBlock = pkg.manifest[field];
      if (!depBlock || typeof depBlock !== "object") {
        continue;
      }

      for (const [depName, currentSpec] of Object.entries(depBlock)) {
        for (const [bumpedKey, bumpedVersion] of bumpedByKey) {
          if (bumpedKey === pkg.key) {
            continue;
          }

          const bumpedPkg = packages.find((p) => p.key === bumpedKey);
          if (!bumpedPkg || bumpedPkg.name !== depName) {
            continue;
          }

          const nextSpec = updateDependencySpecifier(currentSpec, bumpedVersion);
          if (nextSpec === currentSpec) {
            continue;
          }

          depBlock[depName] = nextSpec;
          changed = true;
        }
      }
    }

    if (changed) {
      writeJson(pkg.manifestPathAbs, pkg.manifest);
    }
  }
}

function determineNextRootVersion(currentVersion, now) {
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");

  const dotVersion = `${yyyy}.${mm}.${dd}`;
  const dashedDate = `${yyyy}-${mm}-${dd}`;
  const dashedBuildMatch = currentVersion.match(new RegExp(`^${dashedDate}-(\\d+)$`));

  if (dashedBuildMatch) {
    return `${dashedDate}-${Number(dashedBuildMatch[1]) + 1}`;
  }

  if (currentVersion === dotVersion) {
    return `${dashedDate}-1`;
  }

  return dotVersion;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log("📦 Loading package manifests...");
  const packages = loadPackageManifests();

  console.log(`✅ Loaded ${packages.length} packages`);
  packages.forEach((pkg) => console.log(`   - ${pkg.key}: ${pkg.name} (${pkg.manifest.version})`));

  console.log("\n🔍 Computing package snapshots...");
  const currentSnapshot = computePackageSnapshot(packages);

  const previousState = loadHashState();
  const changedKeys = detectHashChanges(currentSnapshot, previousState);

  if (changedKeys.size === 0 && !args.force) {
    console.log("✅ No changes detected. Run with --force to bump anyway.");
    process.exit(0);
  }

  if (changedKeys.size > 0) {
    console.log(`\n📝 Changed packages:`);
    for (const key of changedKeys) {
      console.log(`   - ${key}`);
    }
  } else if (args.force) {
    console.log(`\n⚠️  No changes detected, but forcing ${args.force} bump.`);
  }

  const bumpedByKey = new Map();
  const bumpType = args.force || (changedKeys.size > 0 ? "patch" : null);

  if (bumpType) {
    console.log(`\n🚀 Bumping with type: ${bumpType}`);
    for (const pkg of packages) {
      // Only bump packages that actually changed
      if (!changedKeys.has(pkg.key)) {
        continue;
      }

      const newVersion = bumpSemver(pkg.manifest.version, bumpType);
      bumpedByKey.set(pkg.key, newVersion);
      console.log(`   ${pkg.key}: ${pkg.manifest.version} → ${newVersion}`);
    }
  }

  let changelogUpdates = new Map();
  if (bumpedByKey.size > 0) {
    console.log(`\n🔗 Updating internal dependencies...`);
    updateLocalDependencies(packages, bumpedByKey);

    for (const [key, newVersion] of bumpedByKey) {
      const pkg = packages.find((p) => p.key === key);
      if (pkg) {
        pkg.manifest.version = newVersion;
        writeJson(pkg.manifestPathAbs, pkg.manifest);

        // Try to update CHANGELOG.md
        const changelogPath = path.join(path.dirname(pkg.manifestPathAbs), "CHANGELOG.md");
        const updated = updateChangelog(changelogPath, newVersion);
        changelogUpdates.set(key, updated);
      }
    }

  }

  const newSnapshot = { schemaVersion: HASH_STATE_VERSION, packages: currentSnapshot };

  if (args.dryRun) {
    console.log("\n📋 Dry-run mode - no files written.");
    console.log("\nWould update .bump-hashes.json with new snapshots.");
    if (bumpedByKey.size > 0) {
      console.log("Would update versions in package.json files:");
      for (const [key, newVersion] of bumpedByKey) {
        const pkg = packages.find((p) => p.key === key);
        console.log(`   ${pkg?.manifestPath}: ${pkg?.manifest.version}`);
      }
      console.log("\nWould update CHANGELOG.md files:");
      const today = getTodayDate();
      for (const [key, newVersion] of bumpedByKey) {
        if (changelogUpdates.get(key)) {
          console.log(
            `   ${key}/CHANGELOG.md: [Unreleased] → [${newVersion}] - ${today}`
          );
        } else {
          console.log(`   ${key}/CHANGELOG.md: (not found, skipped)`);
        }
      }
    }
  } else {
    writeJson(HASH_STATE_PATH, newSnapshot);
    console.log("\n✅ Updated .bump-hashes.json");
    if (bumpedByKey.size > 0) {
      console.log("✅ Updated package.json versions");
      const updated = Array.from(changelogUpdates.entries()).filter(([, v]) => v);
      if (updated.length > 0) {
        console.log("✅ Updated CHANGELOG.md files:");
        for (const [key] of updated) {
          console.log(`   ${key}/CHANGELOG.md`);
        }
      }
      const skipped = Array.from(changelogUpdates.entries()).filter(([, v]) => !v);
      if (skipped.length > 0) {
        console.log("⏭️  Skipped CHANGELOG.md files (not found):");
        for (const [key] of skipped) {
          console.log(`   ${key}/CHANGELOG.md`);
        }
      }
    }
  }

  console.log("\n💡 Tip: Run 'git diff' to review changes before committing.");
}

main().catch((error) => {
  console.error("❌ Fatal error:", error.message);
  process.exit(1);
});
