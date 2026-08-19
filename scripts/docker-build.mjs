#!/usr/bin/env node

/**
 * BetTrack Docker build and push.
 *
 *   npm run docker:build -- backend              build locally, host arch
 *   npm run docker:build -- --all --push         build and push both, multi-arch
 *   npm run docker:build -- --from-tag 2026.08.18 --push --latest
 *   npm run docker:build -- --dry-run            print the buildx commands
 *
 * Replaces docker-build.sh and docker-build.ps1, which each carried their own
 * copy of this logic. Two things they got wrong, fixed here:
 *
 *   1. They ran `docker build --platform a,b` then `docker tag` and
 *      `docker push`. Classic `docker build` cannot put a manifest list in the
 *      local image store without the containerd image store enabled, so the
 *      default flags failed on a stock Docker install. Multi-platform is one
 *      `docker buildx build --push`, never a build-then-tag-then-push.
 *   2. They pushed `latest` on every `--push`, from any branch. Moving the
 *      published `latest` now takes an explicit --latest and a clean tree on
 *      the release branch.
 *
 * Versions come from the manifests via bump-version.mjs, or from a release tag
 * via release.mjs --from-tag, so an image tag always matches what is inside it.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const BUMP_SCRIPT = path.join(SCRIPT_DIR, "bump-version.mjs");
const RELEASE_SCRIPT = path.join(SCRIPT_DIR, "release.mjs");

const DEFAULT_REGISTRY = "ghcr.io";
const DEFAULT_REPOSITORY = "bettrack";
const DEFAULT_BRANCH = "main";
const MULTI_ARCH_PLATFORMS = "linux/amd64,linux/arm64";
const CACHE_DIR = path.join(ROOT_DIR, ".docker-cache");

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

/**
 * The two images this repo publishes. `packageKey` is the bump-version.mjs key
 * whose version tags the image; `context` is the workspace root because both
 * Dockerfiles install from the shared package-lock.
 */
const IMAGES = {
  backend: {
    aliases: ["backend", "be", "api"],
    packageKey: "dashboard/backend",
    context: "dashboard",
    dockerfile: "dashboard/backend/Dockerfile",
    title: "BetTrack Backend",
    description: "BetTrack dashboard API",
  },
  frontend: {
    aliases: ["frontend", "fe", "ui"],
    packageKey: "dashboard/frontend",
    context: "dashboard",
    dockerfile: "dashboard/frontend/Dockerfile",
    title: "BetTrack Frontend",
    description: "BetTrack dashboard web UI",
  },
};

/**
 * Release scopes, matching release.mjs's vocabulary so the same word means the
 * same thing across the toolchain. `mcp` is deliberately absent — it ships as
 * an MCPB package and has no image.
 */
const SCOPE_IMAGES = {
  all: ["backend", "frontend"],
  dashboard: ["backend", "frontend"],
  web: ["backend", "frontend"],
  full: ["backend", "frontend"],
  repo: ["backend", "frontend"],
};

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class DockerBuildError extends Error {}

function fail(message) {
  throw new DockerBuildError(message);
}

function printUsage() {
  console.log(
    `
Usage:
  npm run docker:build -- <target> [options]

Targets:
  backend            just the backend image      (aliases: be, api)
  frontend           just the frontend image     (aliases: fe, ui)
  dashboard | all    both images                 (aliases: web, full, repo)
  --all              same as "all"

Options:
  --push                Push to the registry (multi-arch by default)
  --latest             Also move the :latest tag — needs a clean tree on ${DEFAULT_BRANCH}
  --version <v>         Tag with this version instead of reading the manifests
  --from-tag <tag>      Take versions from a release tag (e.g. 2026.08.18)
  --platform <list>     Override platforms (default: ${MULTI_ARCH_PLATFORMS} when
                        pushing, the host platform when building locally)
  --owner <user>        Registry owner (default: detected from the git remote)
  --repository <name>   Image path prefix (default: ${DEFAULT_REPOSITORY})
  --registry <host>     Registry host (default: ${DEFAULT_REGISTRY})
  --no-cache            Disable the build cache entirely
  --no-public           Skip making the pushed package public
  --allow-dirty         Permit --latest from a dirty tree
  --dry-run             Print the buildx commands, run nothing
  --help, -h            Show this message

Environment:
  GITHUB_TOKEN          Required for --push. export GITHUB_TOKEN="$(gh auth token)"

Examples:
  npm run docker:build -- backend
  npm run docker:build -- all --push
  npm run docker:build -- backend --push --latest
  npm run docker:build -- --from-tag 2026.08.18 --push --latest
  npm run docker:build -- all --dry-run
`.trim()
  );
}

// ---------------------------------------------------------------------------
// Shell helpers
// ---------------------------------------------------------------------------

function runGit(args, { allowFailure = true } = {}) {
  try {
    return execFileSync("git", args, {
      cwd: ROOT_DIR,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    if (allowFailure) {
      return null;
    }

    fail(`git ${args.join(" ")} failed: ${error.stderr?.toString().trim() ?? error.message}`);
  }
}

function runNodeScript(args) {
  try {
    return execFileSync(process.execPath, args, {
      cwd: ROOT_DIR,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    fail(`${path.basename(args[0])} failed: ${error.stderr?.toString().trim() ?? error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

export function resolveTarget(token) {
  const normalized = String(token).trim().toLowerCase();

  for (const [name, image] of Object.entries(IMAGES)) {
    if (image.aliases.includes(normalized)) {
      return [name];
    }
  }

  if (Object.hasOwn(SCOPE_IMAGES, normalized)) {
    return [...SCOPE_IMAGES[normalized]];
  }

  if (normalized === "mcp" || normalized === "server") {
    fail("The MCP server ships as an MCPB package, not a Docker image. Use `npm run release -- mcp`.");
  }

  fail(`Unknown target "${token}". Expected backend, frontend, dashboard, or all.`);
}

export function parseArgs(args) {
  const parsed = {
    targets: [],
    push: false,
    latest: false,
    version: null,
    fromTag: null,
    platform: null,
    owner: null,
    repository: DEFAULT_REPOSITORY,
    registry: DEFAULT_REGISTRY,
    noCache: false,
    noPublic: false,
    allowDirty: false,
    dryRun: false,
    help: false,
  };

  const takeValue = (flag, inlineValue, nextValue, label) => {
    if (inlineValue !== undefined) {
      if (!inlineValue) {
        fail(`Missing ${label} after ${flag}.`);
      }
      return { value: inlineValue, consumed: 0 };
    }

    if (!nextValue) {
      fail(`Missing ${label} after ${flag}.`);
    }

    return { value: nextValue, consumed: 1 };
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const [flag, inlineValue] =
      arg.startsWith("--") && arg.includes("=")
        ? [arg.slice(0, arg.indexOf("=")), arg.slice(arg.indexOf("=") + 1)]
        : [arg, undefined];

    const valued = {
      "--version": "version",
      "--from-tag": "fromTag",
      "--platform": "platform",
      "--owner": "owner",
      "--repository": "repository",
      "--registry": "registry",
    };

    if (Object.hasOwn(valued, flag)) {
      const { value, consumed } = takeValue(flag, inlineValue, args[i + 1], flag.slice(2));
      parsed[valued[flag]] = value;
      i += consumed;
      continue;
    }

    switch (flag) {
      case "--help":
      case "-h":
        parsed.help = true;
        continue;
      case "--push":
        parsed.push = true;
        continue;
      case "--latest":
        parsed.latest = true;
        continue;
      case "--no-cache":
        parsed.noCache = true;
        continue;
      case "--no-public":
        parsed.noPublic = true;
        continue;
      case "--allow-dirty":
        parsed.allowDirty = true;
        continue;
      case "--dry-run":
        parsed.dryRun = true;
        continue;
      // Legacy spellings from docker-build.sh, kept so existing muscle memory
      // and any scripted callers keep working.
      case "--backend":
        parsed.targets.push("backend");
        continue;
      case "--frontend":
        parsed.targets.push("frontend");
        continue;
      case "--all":
        parsed.targets.push("backend", "frontend");
        continue;
      default:
        break;
    }

    if (arg.startsWith("-")) {
      fail(`Unknown argument "${arg}". Run with --help for usage.`);
    }

    parsed.targets.push(...resolveTarget(arg));
  }

  if (parsed.version && parsed.fromTag) {
    fail("--version and --from-tag both set the version. Pick one.");
  }

  // De-duplicate while keeping declaration order stable.
  parsed.targets = Object.keys(IMAGES).filter((name) => parsed.targets.includes(name));

  if (parsed.targets.length === 0 && !parsed.help) {
    fail("No target given. Try `backend`, `frontend`, or `all` — or --help.");
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------

/** Map image names to their versions, from a release tag or the manifests. */
export function versionsFrom(plan, targets, override) {
  const byKey = new Map(plan.packages.map((pkg) => [pkg.key, pkg]));
  const versions = {};

  for (const name of targets) {
    if (override) {
      versions[name] = override;
      continue;
    }

    const pkg = byKey.get(IMAGES[name].packageKey);

    if (!pkg) {
      fail(`Could not find a version for ${name} (${IMAGES[name].packageKey}) in the plan.`);
    }

    // bump-version.mjs reports the version currently in the manifest as
    // `currentVersion`; release.mjs --from-tag reports the released version as
    // `nextVersion`. Either way, what we want is what is checked out now.
    versions[name] = pkg.currentVersion ?? pkg.nextVersion;
  }

  return versions;
}

function resolveVersions(args) {
  if (args.version) {
    return Object.fromEntries(args.targets.map((name) => [name, args.version]));
  }

  const keys = args.targets.map((name) => IMAGES[name].packageKey);
  const output = args.fromTag
    ? runNodeScript([RELEASE_SCRIPT, "--from-tag", args.fromTag, "--json"])
    : runNodeScript([BUMP_SCRIPT, ...keys, "--json"]);

  let plan;
  try {
    plan = JSON.parse(output);
  } catch {
    fail(`Could not parse the version plan:\n${output}`);
  }

  return versionsFrom(plan, args.targets, null);
}

// ---------------------------------------------------------------------------
// Registry naming
// ---------------------------------------------------------------------------

export function detectOwner(remoteUrl) {
  if (!remoteUrl) {
    return null;
  }

  const match = String(remoteUrl).match(/github\.com[:/]([^/]+)\//);
  return match ? match[1] : null;
}

/** Registry paths must be lowercase; GitHub usernames need not be. */
export function imageRef({ registry, owner, repository, image }) {
  return `${registry}/${owner}/${repository}/${image}`.toLowerCase();
}

// ---------------------------------------------------------------------------
// The `latest` guard
// ---------------------------------------------------------------------------

/**
 * Moving `latest` republishes what every `docker pull` without a tag receives,
 * so it takes more than a flag: the working tree has to be clean and on the
 * release branch. Returns the problems, empty when it is safe.
 */
export function evaluateLatestPolicy({ latest, push, branch, currentBranch, dirty, allowDirty }) {
  if (!latest) {
    return [];
  }

  const problems = [];

  if (!push) {
    problems.push("--latest only means something with --push.");
  }

  if (currentBranch !== branch) {
    problems.push(
      `latest may only be moved from "${branch}" — you are on "${currentBranch}". A stray build would become what everyone pulls.`
    );
  }

  if (dirty && !allowDirty) {
    problems.push("latest may only be moved from a clean tree, so the image matches a real commit. Use --allow-dirty to override.");
  }

  return problems;
}

// ---------------------------------------------------------------------------
// Buildx invocation
// ---------------------------------------------------------------------------

/**
 * Assemble the `docker buildx build` argument list. Pure, so the exact command
 * is testable without a Docker daemon.
 */
export function buildxArgs({
  context,
  dockerfile,
  tags,
  labels,
  platforms,
  push,
  cacheFrom = [],
  cacheTo = [],
  noCache = false,
}) {
  const args = ["buildx", "build", "--file", dockerfile];

  for (const tag of tags) {
    args.push("--tag", tag);
  }

  for (const [key, value] of Object.entries(labels)) {
    args.push("--label", `${key}=${value}`);
  }

  if (platforms) {
    args.push("--platform", platforms);
  }

  if (noCache) {
    args.push("--no-cache");
  } else {
    cacheFrom.forEach((entry) => args.push("--cache-from", entry));
    cacheTo.forEach((entry) => args.push("--cache-to", entry));
  }

  // A multi-platform result cannot be loaded into the local image store, so a
  // non-pushing build stays single-platform and --load makes it usable.
  args.push(push ? "--push" : "--load");
  args.push(context);

  return args;
}

/**
 * Quote an argument for display only. Labels carry spaces, so an unquoted echo
 * of the command would not survive a copy-paste into a shell.
 */
export function shellQuote(value) {
  return /^[A-Za-z0-9_@%+=:,./-]+$/.test(value) ? value : `'${String(value).replace(/'/g, `'\\''`)}'`;
}

/** The OCI label set, matching what docker/metadata-action applies in CI. */
export function ociLabels({ image, version, revision, created, repositoryUrl }) {
  return {
    "org.opencontainers.image.source": repositoryUrl,
    "org.opencontainers.image.url": repositoryUrl,
    "org.opencontainers.image.version": version,
    "org.opencontainers.image.revision": revision,
    "org.opencontainers.image.created": created,
    "org.opencontainers.image.title": image.title,
    "org.opencontainers.image.description": image.description,
  };
}

export function cacheEntriesFor({ name, ref, push, dir = CACHE_DIR, cacheExists = existsSync }) {
  const local = path.join(dir, name);
  const cacheFrom = [];
  const cacheTo = [`type=local,dest=${local},mode=max`];

  // Importing a cache directory that does not exist yet is harmless but makes
  // buildx print a warning on every first build, so only read what is there.
  if (cacheExists(path.join(local, "index.json"))) {
    cacheFrom.push(`type=local,src=${local}`);
  }

  if (push) {
    // A registry cache is shared with CI and with other machines; the local one
    // only helps repeat builds here.
    cacheFrom.unshift(`type=registry,ref=${ref}:buildcache`);
    cacheTo.push(`type=registry,ref=${ref}:buildcache,mode=max`);
  }

  return { cacheFrom, cacheTo };
}

// ---------------------------------------------------------------------------
// Docker environment
// ---------------------------------------------------------------------------

function checkDocker() {
  const version = spawnSync("docker", ["--version"], { encoding: "utf8" });

  if (version.error || version.status !== 0) {
    fail("Docker is not installed or not on PATH.");
  }

  const info = spawnSync("docker", ["info"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

  if (info.status !== 0) {
    fail("The Docker daemon is not running.");
  }

  const buildx = spawnSync("docker", ["buildx", "version"], { encoding: "utf8" });

  if (buildx.status !== 0) {
    fail("docker buildx is not available. Install the Buildx plugin — multi-platform builds require it.");
  }

  return {
    docker: version.stdout.trim(),
    buildx: buildx.stdout.trim().split("\n")[0],
  };
}

function hostPlatform() {
  const arch = process.arch === "arm64" ? "arm64" : process.arch === "x64" ? "amd64" : process.arch;
  return `linux/${arch}`;
}

function ghcrLogin(registry, owner, { dryRun }) {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    fail(
      `GITHUB_TOKEN is not set — required to push to ${registry}.\n` +
        '   export GITHUB_TOKEN="$(gh auth token)"   # see docs/CREDENTIALS.md'
    );
  }

  if (dryRun) {
    console.log(`   would log in to ${registry} as ${owner}`);
    return;
  }

  const result = spawnSync("docker", ["login", registry, "-u", owner, "--password-stdin"], {
    input: token,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    fail(`docker login to ${registry} failed: ${result.stderr?.trim()}`);
  }

  console.log(`   ✅ logged in to ${registry}`);
}

/**
 * GHCR packages are private on first push. Existing behaviour is to flip them
 * public; it stays opt-out via --no-public, and only runs after a push that
 * actually succeeded.
 */
function setPackagePublic(owner, packageName, { dryRun }) {
  const encoded = packageName.replace(/\//g, "%2F");
  const url = `https://api.github.com/user/packages/container/${encoded}`;

  if (dryRun) {
    console.log(`   would set ${packageName} visibility → public`);
    return;
  }

  const result = spawnSync(
    "curl",
    [
      "-s", "-o", "/dev/null", "-w", "%{http_code}",
      "-X", "PATCH", url,
      "-H", `Authorization: Bearer ${process.env.GITHUB_TOKEN}`,
      "-H", "Accept: application/vnd.github+json",
      "-H", "X-GitHub-Api-Version: 2022-11-28",
      "-d", '{"visibility":"public"}',
    ],
    { encoding: "utf8" }
  );

  if (result.stdout?.trim() === "200") {
    console.log(`   ✅ ${packageName} is public`);
  } else {
    console.log(
      `   ⚠️  could not set ${packageName} public (HTTP ${result.stdout?.trim() || "?"}). ` +
        "Set it in GitHub → Packages → Package settings."
    );
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    return;
  }

  const owner = args.owner ?? detectOwner(runGit(["config", "--get", "remote.origin.url"]));

  if (!owner) {
    fail("Could not detect the registry owner from the git remote. Pass --owner.");
  }

  const currentBranch = runGit(["rev-parse", "--abbrev-ref", "HEAD"]) ?? "";
  const dirty = Boolean(runGit(["status", "--porcelain"]));
  const revision = runGit(["rev-parse", "HEAD"]) ?? "unknown";

  const latestProblems = evaluateLatestPolicy({
    latest: args.latest,
    push: args.push,
    branch: DEFAULT_BRANCH,
    currentBranch,
    dirty,
    allowDirty: args.allowDirty,
  });

  if (latestProblems.length > 0) {
    console.error("❌ Refusing to move :latest");
    latestProblems.forEach((problem) => console.error(`   • ${problem}`));
    process.exitCode = 1;
    return;
  }

  const versions = resolveVersions(args);
  const platforms = args.platform ?? (args.push ? MULTI_ARCH_PLATFORMS : hostPlatform());

  if (!args.push && platforms.includes(",")) {
    fail(
      `Cannot build ${platforms} without --push: a multi-platform image has no single-platform form to load locally.\n` +
        "   Add --push, or pick one platform with --platform."
    );
  }

  console.log("🐳 BetTrack Docker build\n");
  console.log(`   registry  : ${args.registry}/${owner.toLowerCase()}/${args.repository}`);
  console.log(`   targets   : ${args.targets.join(", ")}`);
  console.log(`   platforms : ${platforms}`);
  console.log(`   mode      : ${args.push ? "build + push" : "build + load (local only)"}`);
  console.log(`   latest    : ${args.latest ? "will be moved" : "untouched"}`);
  for (const name of args.targets) {
    console.log(`   ${name.padEnd(10)}: ${versions[name]}`);
  }
  console.log("");

  if (!args.dryRun) {
    const docker = checkDocker();
    console.log(`   ${docker.docker} · ${docker.buildx}\n`);
  }

  if (args.push) {
    ghcrLogin(args.registry, owner, { dryRun: args.dryRun });
    console.log("");
  }

  const repositoryUrl = `https://github.com/${owner}/BetTrack`;
  const created = new Date().toISOString();
  const pushed = [];

  for (const name of args.targets) {
    const image = IMAGES[name];
    const dockerfile = path.join(ROOT_DIR, image.dockerfile);

    if (!existsSync(dockerfile)) {
      fail(`${name} Dockerfile not found: ${image.dockerfile}`);
    }

    const ref = imageRef({
      registry: args.registry,
      owner,
      repository: args.repository,
      image: name,
    });

    const tags = [`${ref}:${versions[name]}`];
    if (args.latest) {
      tags.push(`${ref}:latest`);
    }

    const { cacheFrom, cacheTo } = cacheEntriesFor({ name, ref, push: args.push });

    const commandArgs = buildxArgs({
      context: path.join(ROOT_DIR, image.context),
      dockerfile,
      tags,
      labels: ociLabels({ image, version: versions[name], revision, created, repositoryUrl }),
      platforms,
      push: args.push,
      cacheFrom,
      cacheTo,
      noCache: args.noCache,
    });

    console.log(`📦 ${name} → ${tags.join(", ")}`);

    if (args.dryRun) {
      console.log(`   docker ${commandArgs.map(shellQuote).join(" ")}\n`);
      continue;
    }

    const result = spawnSync("docker", commandArgs, { cwd: ROOT_DIR, stdio: "inherit" });

    if (result.status !== 0) {
      fail(`docker buildx build failed for ${name}.`);
    }

    console.log(`   ✅ ${name} built${args.push ? " and pushed" : ""}\n`);
    pushed.push(name);
  }

  // Visibility is only meaningful for something that actually reached the
  // registry, so this runs after a successful push and never before.
  if (args.push && !args.noPublic) {
    for (const name of args.dryRun ? args.targets : pushed) {
      setPackagePublic(owner, `${args.repository}/${name}`, { dryRun: args.dryRun });
    }
    console.log("");
  }

  if (args.dryRun) {
    console.log("📋 Dry run — nothing built, nothing pushed.");
    return;
  }

  console.log("✅ Done");

  if (args.push) {
    console.log("\n   Pull with:");
    for (const name of pushed) {
      const ref = imageRef({ registry: args.registry, owner, repository: args.repository, image: name });
      console.log(`     docker pull ${ref}:${versions[name]}`);
    }
  } else {
    console.log("   Images are in the local store. Add --push to publish.");
  }
}

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
  try {
    main();
  } catch (error) {
    if (error instanceof DockerBuildError) {
      console.error(`❌ Error: ${error.message}`);
    } else {
      console.error("❌ Fatal error:", error.message);
    }

    process.exit(1);
  }
}
