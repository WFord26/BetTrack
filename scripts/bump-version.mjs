#!/usr/bin/env node

/**
 * BetTrack version bump.
 *
 * Three independently versioned packages (mcp, dashboard/backend,
 * dashboard/frontend) plus the dashboard monorepo wrapper, each bumpable on its
 * own schedule:
 *
 *   npm run bump -- mcp:minor frontend      # explicit targets, explicit levels
 *   npm run bump                            # interactive checklist of changed packages
 *   npm run bump -- --no-input              # non-interactive, inferred levels (CI)
 *
 * The bump level for a package is read from its CHANGELOG.md `[Unreleased]`
 * section: a `Removed` section or a BREAKING marker means major, an `Added`
 * section means minor, anything else means patch.
 *
 * Tagging is a separate step because tags must point at the commit that carries
 * the new version, which does not exist until you commit the bump:
 *
 *   npm run bump -- mcp:minor && git commit -am "chore: bump mcp" && npm run bump:tag
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath, pathToFileURL } from "node:url";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const BUMP_LEVELS = ["patch", "minor", "major"];
const LEVEL_RANK = { patch: 1, minor: 2, major: 3 };

/**
 * Packages whose sources are hashed for change detection. `aliases` are the
 * shorthands accepted on the command line.
 */
const PACKAGE_CONFIGS = [
  {
    key: "mcp",
    aliases: ["mcp", "server"],
    manifestPath: "mcp/package.json",
    // manifest.json is read by Claude Desktop and must stay in sync with package.json
    extraVersionFiles: ["mcp/manifest.json"],
    trackedDirs: ["mcp"],
  },
  {
    key: "dashboard/backend",
    aliases: ["backend", "be", "api"],
    manifestPath: "dashboard/backend/package.json",
    trackedDirs: ["dashboard/backend"],
  },
  {
    key: "dashboard/frontend",
    aliases: ["frontend", "fe", "ui"],
    manifestPath: "dashboard/frontend/package.json",
    trackedDirs: ["dashboard/frontend"],
  },
];

/**
 * The monorepo wrapper. It owns no sources of its own — every file under
 * dashboard/ already belongs to backend or frontend — so it is never hashed.
 * It rolls forward whenever one of its members does, at the highest level any
 * member took, unless its own changelog or an explicit target says otherwise.
 */
const AGGREGATE_CONFIGS = [
  {
    key: "dashboard",
    aliases: ["dashboard", "monorepo", "workspace"],
    manifestPath: "dashboard/package.json",
    members: ["dashboard/backend", "dashboard/frontend"],
  },
];

const HASH_STATE_VERSION = 1;

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const HASH_STATE_PATH = path.join(ROOT_DIR, ".bump-hashes.json");

const IGNORED_PATHS = [/\.tsbuildinfo$/, /\/dist\//, /\/node_modules\//, /CHANGELOG\.md$/, /package\.json$/];
const IGNORED_DIRECTORY_NAMES = new Set(["dist", "node_modules", ".git", "coverage", "__pycache__", ".pytest_cache"]);

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class BumpError extends Error {}

function fail(message) {
  throw new BumpError(message);
}

function printUsage() {
  console.log(
    `
Usage:
  npm run bump                                  Interactive: pick packages and levels
  npm run bump -- <pkg>[:<level>] ...           Bump exactly these packages
  npm run bump -- --no-input                    Bump every changed package at its inferred level
  npm run bump -- --force <patch|minor|major>   Override the inferred level everywhere
  npm run bump:tag                              Tag the current versions (run after committing)

Packages:
  mcp                 (aliases: server)
  dashboard/backend   (aliases: backend, be, api)
  dashboard/frontend  (aliases: frontend, fe, ui)
  dashboard           (aliases: monorepo, workspace) — the workspace wrapper

Levels:
  Inferred per package from its CHANGELOG.md [Unreleased] section:
    "### Removed" or a BREAKING marker  → major
    "### Added"                         → minor
    anything else (Changed/Fixed/...)   → patch
  An explicit <pkg>:<level> always wins; --force overrides every package.

Options:
  --dry-run           Report what would change, write nothing
  --no-input          Never prompt (implied when stdin is not a TTY)
  --force <level>     Apply this level to every selected package
  --since <git-ref>   Detect changes against a git ref instead of the hash state
  --tag               Tag mode: create <pkg>-v<version> tags at HEAD, no version writes
  --allow-dirty       Tag mode: tag even with a dirty working tree
  --help, -h          Show this message

Examples:
  npm run bump -- mcp:minor frontend:patch
  npm run bump -- backend                       # backend at its inferred level
  npm run bump -- --no-input --dry-run
  npm run bump -- --since origin/main
  npm run bump:tag -- mcp                       # tag only the mcp package
`.trim()
  );
}

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

/** Every package key, hashed and aggregate alike, in display order. */
export function allPackageKeys() {
  return [...PACKAGE_CONFIGS, ...AGGREGATE_CONFIGS].map((config) => config.key);
}

/** Resolve a command-line token ("fe", "dashboard/frontend") to a package key. */
export function resolvePackageKey(token) {
  const normalized = token.trim().toLowerCase().replace(/\\/g, "/").replace(/\/+$/, "");

  for (const config of [...PACKAGE_CONFIGS, ...AGGREGATE_CONFIGS]) {
    if (config.key.toLowerCase() === normalized || config.aliases.includes(normalized)) {
      return config.key;
    }
  }

  fail(`Unknown package "${token}". Known packages: ${allPackageKeys().join(", ")}.`);
}

export function parseArgs(args) {
  const parsed = {
    /** Map<packageKey, level|null>. null means "use the inferred level". */
    targets: new Map(),
    force: null,
    since: null,
    dryRun: false,
    noInput: false,
    tagMode: false,
    allowDirty: false,
  };

  const takeValue = (arg, inlineValue, nextValue, label) => {
    if (inlineValue !== undefined) {
      if (!inlineValue) {
        fail(`Missing ${label} after ${arg}.`);
      }
      return { value: inlineValue, consumed: 0 };
    }

    if (!nextValue) {
      fail(`Missing ${label} after ${arg}.`);
    }

    return { value: nextValue, consumed: 1 };
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const [flag, inlineValue] = arg.startsWith("--") && arg.includes("=")
      ? [arg.slice(0, arg.indexOf("=")), arg.slice(arg.indexOf("=") + 1)]
      : [arg, undefined];

    if (flag === "--help" || flag === "-h") {
      return { ...parsed, help: true };
    }

    if (flag === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }

    if (flag === "--no-input" || flag === "--yes" || flag === "-y") {
      parsed.noInput = true;
      continue;
    }

    if (flag === "--tag" || flag === "--tag-only") {
      parsed.tagMode = true;
      continue;
    }

    if (flag === "--allow-dirty") {
      parsed.allowDirty = true;
      continue;
    }

    if (flag === "--force") {
      const { value, consumed } = takeValue(flag, inlineValue, args[i + 1], "bump level");
      parsed.force = value;
      i += consumed;
      continue;
    }

    if (flag === "--since") {
      const { value, consumed } = takeValue(flag, inlineValue, args[i + 1], "git ref");
      parsed.since = value;
      i += consumed;
      continue;
    }

    if (arg.startsWith("-")) {
      fail(`Unknown argument "${arg}". Run with --help for usage.`);
    }

    // A bare level is the legacy form of --force <level>.
    if (BUMP_LEVELS.includes(arg)) {
      parsed.force = arg;
      continue;
    }

    // Otherwise this is a package target, optionally with an explicit level.
    const separator = arg.lastIndexOf(":");
    const rawName = separator === -1 ? arg : arg.slice(0, separator);
    const rawLevel = separator === -1 ? null : arg.slice(separator + 1);

    if (rawLevel !== null && !BUMP_LEVELS.includes(rawLevel)) {
      fail(`Invalid level "${rawLevel}" in "${arg}". Expected ${BUMP_LEVELS.join("|")}.`);
    }

    const key = resolvePackageKey(rawName);
    const existing = parsed.targets.get(key);

    // Later specs win, but "pkg pkg:minor" should keep the explicit level.
    parsed.targets.set(key, rawLevel ?? existing ?? null);
  }

  if (parsed.force && !BUMP_LEVELS.includes(parsed.force)) {
    fail(`Invalid force level "${parsed.force}". Expected ${BUMP_LEVELS.join("|")}.`);
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    parsed.noInput = true;
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// Semver
// ---------------------------------------------------------------------------

export function bumpSemver(version, level) {
  const match = String(version).match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].+)?$/);
  if (!match) {
    fail(`Cannot ${level} bump non-semver version "${version}".`);
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);

  if (level === "patch") {
    return `${major}.${minor}.${patch + 1}`;
  }

  if (level === "minor") {
    return `${major}.${minor + 1}.0`;
  }

  if (level === "major") {
    return `${major + 1}.0.0`;
  }

  fail(`Unsupported bump level "${level}".`);
}

/** The highest of the given levels, or null when none were supplied. */
export function maxLevel(levels) {
  let best = null;

  for (const level of levels) {
    if (!level) {
      continue;
    }

    if (!best || LEVEL_RANK[level] > LEVEL_RANK[best]) {
      best = level;
    }
  }

  return best;
}

export function updateDependencySpecifier(currentSpecifier, newVersion) {
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

// ---------------------------------------------------------------------------
// Changelog: level inference and release rewriting
// ---------------------------------------------------------------------------

const BREAKING_PATTERN = /breaking[ -]change|\*\*breaking|\bbreaking\b\s*:/i;

/**
 * The body of the `## [Unreleased]` section, up to the next `##` heading or a
 * `---` separator. Returns null when the file has no such section.
 */
export function extractUnreleasedSection(content) {
  const lines = String(content).split(/\r?\n/);
  const startIndex = lines.findIndex((line) => /^## \[Unreleased\]/i.test(line));

  if (startIndex === -1) {
    return null;
  }

  const body = [];

  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];

    if (/^## /.test(line) || /^---\s*$/.test(line)) {
      break;
    }

    body.push(line);
  }

  return body.join("\n");
}

/**
 * Map an `[Unreleased]` section onto a bump level, or null when the section is
 * absent or empty. Keep a Changelog section names drive the decision:
 * Removed (or any BREAKING marker) is a break, Added is a feature, and
 * everything else — Changed, Fixed, Security, Deprecated, Performance — is a fix.
 */
export function inferLevelFromChangelog(content) {
  const section = extractUnreleasedSection(content);

  if (section === null) {
    return { level: null, reason: "no [Unreleased] section" };
  }

  const lines = section.split("\n");
  const sectionEntryCounts = new Map();
  const looseEntries = [];
  let currentSection = null;

  for (const line of lines) {
    const headingMatch = line.match(/^#{3,}\s+(.+?)\s*$/);

    if (headingMatch) {
      currentSection = headingMatch[1].toLowerCase();
      if (!sectionEntryCounts.has(currentSection)) {
        sectionEntryCounts.set(currentSection, 0);
      }
      continue;
    }

    if (!line.trim()) {
      continue;
    }

    if (currentSection) {
      sectionEntryCounts.set(currentSection, sectionEntryCounts.get(currentSection) + 1);
    } else {
      looseEntries.push(line);
    }
  }

  const populated = new Set(
    [...sectionEntryCounts.entries()].filter(([, count]) => count > 0).map(([name]) => name)
  );
  const hasContent = populated.size > 0 || looseEntries.length > 0;

  if (!hasContent) {
    return { level: null, reason: "[Unreleased] is empty" };
  }

  if (BREAKING_PATTERN.test(section)) {
    return { level: "major", reason: "BREAKING marker in [Unreleased]" };
  }

  if (populated.has("removed")) {
    return { level: "major", reason: "[Unreleased] has a Removed section" };
  }

  if (populated.has("added")) {
    return { level: "minor", reason: "[Unreleased] has an Added section" };
  }

  if (populated.size > 0) {
    const names = [...populated].sort().join(", ");
    return { level: "patch", reason: `[Unreleased] has only ${names}` };
  }

  return { level: "patch", reason: "[Unreleased] has entries but no section headings" };
}

/**
 * Move everything under `[Unreleased]` into a new released section, leaving
 * `[Unreleased]` in place and empty. Pure: returns the new content and whether
 * anything changed.
 */
export function renderChangelogRelease(content, newVersion, today) {
  const unreleasedPattern = /^## \[Unreleased\]\n/m;

  if (!unreleasedPattern.test(content)) {
    return { content, changed: false };
  }

  const versionHeader = `## [${newVersion}] - ${today}`;
  return {
    content: content.replace(unreleasedPattern, `## [Unreleased]\n\n---\n\n${versionHeader}\n`),
    changed: true,
  };
}

export function getTodayDate(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ---------------------------------------------------------------------------
// Package loading
// ---------------------------------------------------------------------------

function loadManifest(config, { aggregate }) {
  const manifestPathAbs = path.join(ROOT_DIR, config.manifestPath);

  if (!existsSync(manifestPathAbs)) {
    fail(`Package manifest ${config.manifestPath} does not exist.`);
  }

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
    aggregate,
    members: config.members ?? [],
    manifestPath: config.manifestPath,
    manifestPathAbs,
    manifest,
    trackedDirs: config.trackedDirs ?? [],
    changelogPathAbs: path.join(path.dirname(manifestPathAbs), "CHANGELOG.md"),
    extraVersionFiles: (config.extraVersionFiles ?? []).map((rel) => path.join(ROOT_DIR, rel)),
  };
}

function loadPackages() {
  return [
    ...PACKAGE_CONFIGS.map((config) => loadManifest(config, { aggregate: false })),
    ...AGGREGATE_CONFIGS.map((config) => loadManifest(config, { aggregate: true })),
  ];
}

// ---------------------------------------------------------------------------
// Change detection
// ---------------------------------------------------------------------------

function hasHeadCommit() {
  return Boolean(runGit(["rev-parse", "--verify", "--quiet", "HEAD"], { allowFailure: true }));
}

function isIgnoredPath(filePath) {
  return IGNORED_PATHS.some((pattern) => pattern.test(filePath));
}

function isIgnoredDirectory(dirName) {
  return IGNORED_DIRECTORY_NAMES.has(dirName);
}

function walkPackageFiles(directories) {
  const files = [];

  for (const directory of directories) {
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

        if (!entry.isFile() || isIgnoredPath(relPath)) {
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
    if (pkg.aggregate) {
      continue;
    }

    const fileHashes = {};

    for (const absPath of walkPackageFiles(pkg.trackedDirs)) {
      fileHashes[relFromRoot(absPath)] = hashValue(readFileSync(absPath));
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

function detectChangesSinceRef(packages, sinceRef) {
  const trackedPaths = packages.flatMap((pkg) => pkg.trackedDirs);

  if (!hasHeadCommit()) {
    fail(`Cannot use --since ${sinceRef} because this repository has no commits yet.`);
  }

  if (!runGit(["rev-parse", "--verify", "--quiet", sinceRef], { allowFailure: true })) {
    fail(`Git ref "${sinceRef}" does not exist.`);
  }

  const changedFiles = new Set();
  const add = (files) => files.forEach((file) => changedFiles.add(file));

  add(gitLines(["diff", "--name-only", `${sinceRef}...HEAD`, "--", ...trackedPaths], { allowFailure: true }));
  add(gitLines(["diff", "--name-only", "HEAD", "--", ...trackedPaths], { allowFailure: true }));
  add(gitLines(["ls-files", "--others", "--exclude-standard", "--", ...trackedPaths], { allowFailure: true }));

  const changedKeys = new Set();

  for (const file of changedFiles) {
    if (isIgnoredPath(file)) {
      continue;
    }

    for (const pkg of packages) {
      if (pkg.trackedDirs.some((dir) => file === dir || file.startsWith(`${dir}/`))) {
        changedKeys.add(pkg.key);
      }
    }
  }

  return changedKeys;
}

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

/**
 * Build one row per package describing what would happen to it. A row is
 * selected when the user named it, or — with no explicit targets — when its
 * sources changed. Aggregates follow their members.
 */
export function buildPlan(packages, { changedKeys, targets, force, changelogReader }) {
  const hasExplicitTargets = targets.size > 0;
  const rows = [];
  const levelByKey = new Map();

  for (const pkg of packages) {
    const explicitLevel = targets.get(pkg.key) ?? null;
    const selected = hasExplicitTargets
      ? targets.has(pkg.key)
      : pkg.aggregate
        ? pkg.members.some((member) => changedKeys.has(member))
        : changedKeys.has(pkg.key);

    const inferred = inferLevelFromChangelog(changelogReader(pkg));
    let level;
    let levelSource;

    if (explicitLevel) {
      level = explicitLevel;
      levelSource = "requested";
    } else if (force) {
      level = force;
      levelSource = "--force";
    } else if (inferred.level) {
      level = inferred.level;
      levelSource = inferred.reason;
    } else if (pkg.aggregate) {
      const memberLevel = maxLevel(pkg.members.map((member) => levelByKey.get(member)));
      level = memberLevel ?? "patch";
      levelSource = memberLevel ? `highest of its workspaces (${memberLevel})` : "default";
    } else {
      level = "patch";
      levelSource = `default (${inferred.reason})`;
    }

    levelByKey.set(pkg.key, selected ? level : null);

    rows.push({
      key: pkg.key,
      pkg,
      selected,
      level,
      levelSource,
      changed: pkg.aggregate
        ? pkg.members.some((member) => changedKeys.has(member))
        : changedKeys.has(pkg.key),
      currentVersion: pkg.manifest.version,
    });
  }

  return rows;
}

function readChangelog(pkg) {
  return existsSync(pkg.changelogPathAbs) ? readFileSync(pkg.changelogPathAbs, "utf8") : "";
}

// ---------------------------------------------------------------------------
// Interactive checklist
// ---------------------------------------------------------------------------

function renderChecklist(rows, cursor) {
  const lines = [
    "Select packages to bump:",
    "  ↑/↓ move · space toggle · ←/→ level · a all · n none · enter confirm · q cancel",
    "",
  ];

  const keyWidth = Math.max(...rows.map((row) => row.key.length));

  for (const [index, row] of rows.entries()) {
    const pointer = index === cursor ? "\u001b[36m❯\u001b[0m" : " ";
    const box = row.selected ? "[x]" : "[ ]";
    const detail = row.selected
      ? `${row.currentVersion} → ${bumpSemver(row.currentVersion, row.level)}  (${row.level})`
      : `${row.currentVersion}  (skip)`;
    const suffix = row.changed ? "" : "  · no source changes detected";
    lines.push(`${pointer} ${box} ${row.key.padEnd(keyWidth)}  ${detail}${suffix}`);
  }

  return lines;
}

function drawChecklist(lines, previousLineCount) {
  if (previousLineCount > 0) {
    process.stdout.write(`\u001b[${previousLineCount}A`);
  }

  for (const line of lines) {
    process.stdout.write(`\u001b[2K${line}\n`);
  }

  return lines.length;
}

/**
 * Let the user toggle rows and cycle levels. Resolves to the edited rows, or
 * null when the user cancels.
 */
function promptChecklist(rows) {
  return new Promise((resolve) => {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();

    let cursor = 0;
    let drawnLines = drawChecklist(renderChecklist(rows, cursor), 0);

    const redraw = () => {
      drawnLines = drawChecklist(renderChecklist(rows, cursor), drawnLines);
    };

    const finish = (result) => {
      process.stdin.off("keypress", onKeypress);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      resolve(result);
    };

    const cycleLevel = (row, direction) => {
      const index = BUMP_LEVELS.indexOf(row.level);
      const next = (index + direction + BUMP_LEVELS.length) % BUMP_LEVELS.length;
      row.level = BUMP_LEVELS[next];
      row.levelSource = "chosen interactively";
      row.selected = true;
    };

    const onKeypress = (_str, key) => {
      if (!key) {
        return;
      }

      if (key.ctrl && key.name === "c") {
        finish(null);
        return;
      }

      switch (key.name) {
        case "up":
        case "k":
          cursor = (cursor - 1 + rows.length) % rows.length;
          break;
        case "down":
        case "j":
          cursor = (cursor + 1) % rows.length;
          break;
        case "space":
          rows[cursor].selected = !rows[cursor].selected;
          break;
        case "right":
        case "l":
          cycleLevel(rows[cursor], 1);
          break;
        case "left":
        case "h":
          cycleLevel(rows[cursor], -1);
          break;
        case "a":
          rows.forEach((row) => {
            row.selected = true;
          });
          break;
        case "n":
          rows.forEach((row) => {
            row.selected = false;
          });
          break;
        case "return":
        case "enter":
          redraw();
          finish(rows);
          return;
        case "escape":
        case "q":
          finish(null);
          return;
        default:
          return;
      }

      redraw();
    };

    process.stdin.on("keypress", onKeypress);
  });
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

function updateLocalDependencies(packages, bumpedByKey) {
  const bumpedNames = new Map();

  for (const [key, version] of bumpedByKey) {
    const pkg = packages.find((candidate) => candidate.key === key);
    if (pkg) {
      bumpedNames.set(pkg.name, { key, version });
    }
  }

  const touched = [];

  for (const pkg of packages) {
    let changed = false;

    for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
      const depBlock = pkg.manifest[field];
      if (!depBlock || typeof depBlock !== "object") {
        continue;
      }

      for (const [depName, currentSpec] of Object.entries(depBlock)) {
        const bumped = bumpedNames.get(depName);
        if (!bumped || bumped.key === pkg.key) {
          continue;
        }

        const nextSpec = updateDependencySpecifier(currentSpec, bumped.version);
        if (nextSpec === currentSpec) {
          continue;
        }

        depBlock[depName] = nextSpec;
        changed = true;
      }
    }

    if (changed) {
      writeJson(pkg.manifestPathAbs, pkg.manifest);
      touched.push(pkg.key);
    }
  }

  return touched;
}

function applyBumps(packages, selectedRows) {
  const bumpedByKey = new Map(selectedRows.map((row) => [row.key, row.nextVersion]));

  updateLocalDependencies(packages, bumpedByKey);

  const changelogResults = new Map();
  const today = getTodayDate();

  for (const row of selectedRows) {
    const { pkg } = row;

    pkg.manifest.version = row.nextVersion;
    writeJson(pkg.manifestPathAbs, pkg.manifest);

    for (const extraPath of pkg.extraVersionFiles) {
      if (existsSync(extraPath)) {
        const extra = readJson(extraPath);
        extra.version = row.nextVersion;
        writeJson(extraPath, extra);
      }
    }

    if (existsSync(pkg.changelogPathAbs)) {
      const original = readFileSync(pkg.changelogPathAbs, "utf8");
      const { content, changed } = renderChangelogRelease(original, row.nextVersion, today);

      if (changed) {
        writeFileSync(pkg.changelogPathAbs, content, "utf8");
      }

      changelogResults.set(row.key, changed ? "updated" : "no [Unreleased] section");
    } else {
      changelogResults.set(row.key, "not found");
    }
  }

  return changelogResults;
}

// ---------------------------------------------------------------------------
// Tag mode
// ---------------------------------------------------------------------------

/** `dashboard/frontend` → `frontend-v0.5.4`. Slugs never collide across keys. */
export function tagNameFor(packageKey, version) {
  const slug = packageKey.includes("/") ? packageKey.slice(packageKey.lastIndexOf("/") + 1) : packageKey;
  return `${slug}-v${version}`;
}

function runTagMode(packages, args) {
  if (!hasHeadCommit()) {
    fail("Cannot tag: this repository has no commits yet.");
  }

  const dirty = runGit(["status", "--porcelain"], { allowFailure: true });

  if (dirty && !args.allowDirty) {
    console.error("❌ Working tree is dirty. Tags would point at the previous commit.");
    console.error("   Commit the version bump first, or pass --allow-dirty if you know better.");
    console.error("\nUncommitted:");
    dirty
      .split(/\r?\n/)
      .slice(0, 10)
      .forEach((line) => console.error(`   ${line}`));
    process.exitCode = 1;
    return;
  }

  const selected = args.targets.size > 0 ? packages.filter((pkg) => args.targets.has(pkg.key)) : packages;
  const head = runGit(["rev-parse", "--short", "HEAD"]);

  console.log(`🏷️  Tagging at HEAD (${head})\n`);

  const created = [];
  const skipped = [];

  for (const pkg of selected) {
    const tag = tagNameFor(pkg.key, pkg.manifest.version);
    const exists = Boolean(runGit(["rev-parse", "--verify", "--quiet", `refs/tags/${tag}`], { allowFailure: true }));

    if (exists) {
      skipped.push(tag);
      console.log(`   ⏭️  ${tag} already exists`);
      continue;
    }

    if (args.dryRun) {
      console.log(`   would create ${tag}`);
    } else {
      runGit(["tag", "-a", tag, "-m", `${pkg.key} v${pkg.manifest.version}`]);
      console.log(`   ✅ ${tag}`);
    }

    created.push(tag);
  }

  if (created.length === 0) {
    console.log(`\n✅ Nothing to tag${skipped.length > 0 ? " — every tag already exists" : ""}.`);
    return;
  }

  if (args.dryRun) {
    console.log("\n📋 Dry-run mode — no tags created.");
    return;
  }

  console.log(`\n💡 Push when ready: git push origin ${created.join(" ")}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    return;
  }

  const packages = loadPackages();

  if (args.tagMode) {
    runTagMode(packages, args);
    return;
  }

  const hashedPackages = packages.filter((pkg) => !pkg.aggregate);
  const currentSnapshot = computePackageSnapshot(packages);
  const changedKeys = args.since
    ? detectChangesSinceRef(hashedPackages, args.since)
    : detectHashChanges(currentSnapshot, loadHashState());

  const rows = buildPlan(packages, {
    changedKeys,
    targets: args.targets,
    force: args.force,
    changelogReader: readChangelog,
  });

  const hasExplicitTargets = args.targets.size > 0;

  if (!hasExplicitTargets && changedKeys.size === 0 && !args.force) {
    console.log("✅ No changes detected.");
    console.log("   Name a package to bump it anyway, e.g. `npm run bump -- frontend:minor`.");
    return;
  }

  console.log("📦 BetTrack version bump\n");
  for (const row of rows) {
    const marker = row.changed ? "changed" : "unchanged";
    console.log(`   ${row.key.padEnd(20)} ${row.currentVersion.padEnd(10)} ${marker}`);
  }
  console.log("");

  let plannedRows = rows;

  if (!hasExplicitTargets && !args.noInput) {
    const answer = await promptChecklist(rows);

    if (answer === null) {
      console.log("\n🚫 Cancelled — nothing written.");
      return;
    }

    plannedRows = answer;
    console.log("");
  }

  const selectedRows = plannedRows
    .filter((row) => row.selected)
    .map((row) => ({ ...row, nextVersion: bumpSemver(row.currentVersion, row.level) }));

  if (selectedRows.length === 0) {
    console.log("✅ Nothing selected — no files written.");
    return;
  }

  console.log("🚀 Planned bumps:");
  for (const row of selectedRows) {
    console.log(`   ${row.key.padEnd(20)} ${row.currentVersion} → ${row.nextVersion}  (${row.level} — ${row.levelSource})`);
  }

  if (args.dryRun) {
    console.log("\n📋 Dry-run mode — no files written. Would update:");
    for (const row of selectedRows) {
      console.log(`   ${row.pkg.manifestPath}`);

      for (const extraPath of row.pkg.extraVersionFiles) {
        if (existsSync(extraPath)) {
          console.log(`   ${relFromRoot(extraPath)} (synced)`);
        }
      }

      if (existsSync(row.pkg.changelogPathAbs)) {
        const hasUnreleased = /^## \[Unreleased\]\n/m.test(readFileSync(row.pkg.changelogPathAbs, "utf8"));
        console.log(
          `   ${relFromRoot(row.pkg.changelogPathAbs)} ${hasUnreleased ? `→ [${row.nextVersion}] - ${getTodayDate()}` : "(no [Unreleased] section, skipped)"}`
        );
      }
    }
    console.log(`   ${relFromRoot(HASH_STATE_PATH)}`);
    return;
  }

  const changelogResults = applyBumps(packages, selectedRows);

  // Re-hash the bumped packages *after* writing. The bump itself edits tracked
  // files (mcp/manifest.json is hashed, unlike package.json and CHANGELOG.md),
  // so baselining the pre-write snapshot would leave those packages reporting
  // as changed on the very next run.
  const bumpedPackages = selectedRows.map((row) => row.pkg);
  const postWriteSnapshot = computePackageSnapshot(bumpedPackages);

  // Only re-baseline the packages that were actually bumped, so a package left
  // unselected still reports as changed on the next run.
  const previousState = loadHashState();
  const nextPackages = { ...(previousState?.packages ?? {}) };

  for (const row of selectedRows) {
    if (postWriteSnapshot[row.key]) {
      nextPackages[row.key] = postWriteSnapshot[row.key];
    }
  }

  writeJson(HASH_STATE_PATH, { schemaVersion: HASH_STATE_VERSION, packages: nextPackages });

  console.log("\n✅ Updated package versions and .bump-hashes.json");
  for (const [key, result] of changelogResults) {
    console.log(`   ${key.padEnd(20)} CHANGELOG.md: ${result}`);
  }

  const tagList = selectedRows.map((row) => tagNameFor(row.key, row.nextVersion)).join(" ");
  console.log("\n💡 Next:");
  console.log("   git diff                # review");
  console.log('   git add -A && git commit -m "chore: bump versions"');
  console.log(`   npm run bump:tag        # creates ${tagList}`);
}

// `import.meta.url` is always the real path, while argv[1] keeps whatever the
// caller typed — on macOS /var is a symlink to /private/var, so the two only
// agree after realpath.
function isInvokedDirectly() {
  if (!process.argv[1]) {
    return false;
  }

  try {
    return pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url;
  } catch {
    return false;
  }
}

if (isInvokedDirectly()) {
  main().catch((error) => {
    if (error instanceof BumpError) {
      console.error(`❌ Error: ${error.message}`);
    } else {
      console.error("❌ Fatal error:", error.message);
    }

    process.exit(1);
  });
}
