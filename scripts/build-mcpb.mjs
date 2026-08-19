#!/usr/bin/env node

/**
 * BetTrack MCPB packaging.
 *
 *   npm run mcpb                       package the current mcp/ version
 *   npm run mcpb -- --dry-run          list what would go in, write nothing
 *   npm run mcpb -- --json             machine-readable result (for CI)
 *
 * An .mcpb is a zip of the MCP server's runtime payload, installed by Claude
 * Desktop. This is the one place that knows what goes in it.
 *
 * It replaces three separate implementations that had drifted apart:
 *
 *   - release.yml ran `python -m mcpb build`, but `mcpb` is in neither
 *     requirements.txt nor requirements-dev.txt, so the step failed and took
 *     the whole release job — including the GitHub Release — down with it.
 *   - on-demand-release.yml zipped a file list inline that omitted
 *     `dashboard_api/`, which sports_mcp_server.py imports at runtime.
 *   - build.sh had the complete list, and was the only one that was right.
 *
 * Every payload is validated before it ships: the manifest version has to match
 * package.json, the declared entry point has to exist, and every asset the
 * manifest references has to be present.
 */

import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const MCP_DIR = path.join(ROOT_DIR, "mcp");
const RELEASE_SCRIPT = path.join(SCRIPT_DIR, "release.mjs");

const PACKAGE_NAME = "sports-data-mcp";

// ---------------------------------------------------------------------------
// Payload
// ---------------------------------------------------------------------------

/**
 * What goes into the bundle. `required` files fail the build when missing;
 * optional ones are skipped with a note, because some (LICENSE) are simply not
 * in the repo yet.
 */
export const PAYLOAD_FILES = [
  { name: "manifest.json", required: true },
  { name: "sports_mcp_server.py", required: true },
  { name: "dashboard_mcp_server.py", required: true },
  { name: "mcpb_bootstrap.py", required: true },
  { name: "setup.py", required: true },
  { name: "requirements.txt", required: true },
  // Declared by manifest.json as the extension icon — Claude Desktop reads it
  // out of the bundle, so shipping without it leaves a dangling reference.
  { name: "icon.png", required: true },
  { name: ".env.example", required: false },
  { name: "INSTALL_INSTRUCTIONS.md", required: false },
  { name: "README.md", required: false },
  { name: "LICENSE", required: false },
];

/**
 * Python packages copied wholesale. `dashboard_api` is not optional despite
 * being an optional *feature*: sports_mcp_server.py imports it at module load
 * and only registers its tools when DASHBOARD_API_KEY is set, so omitting it
 * from the bundle breaks the server outright rather than disabling a feature.
 */
export const PAYLOAD_PACKAGES = ["sports_api", "dashboard_api"];

/** Never ship compiled Python or test caches. */
const EXCLUDED_DIRS = new Set(["__pycache__", ".pytest_cache", ".mypy_cache"]);
const EXCLUDED_SUFFIXES = [".pyc", ".pyo"];

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class McpbError extends Error {}

function fail(message) {
  throw new McpbError(message);
}

function printUsage() {
  console.log(
    `
Usage:
  npm run mcpb                    Package the version in mcp/package.json
  npm run mcpb -- --dry-run       List the payload, write nothing
  npm run mcpb -- --json          Emit the result as JSON

Options:
  --version <v>       Package as this version instead of reading the manifest
  --from-tag <tag>    Take the version from a release tag (e.g. mcp-v1.1.0)
  --out-dir <dir>     Where to write the .mcpb (default: mcp/releases)
  --dry-run           Report the payload and the output path, write nothing
  --json              Emit {version, path, size, entries} as JSON
  --help, -h          Show this message

Output:
  mcp/releases/${PACKAGE_NAME}-v<version>.mcpb
`.trim()
  );
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

export function parseArgs(args) {
  const parsed = {
    version: null,
    fromTag: null,
    outDir: null,
    dryRun: false,
    json: false,
    help: false,
  };

  const takeValue = (flag, inlineValue, nextValue) => {
    if (inlineValue !== undefined) {
      if (!inlineValue) {
        fail(`Missing value after ${flag}.`);
      }
      return { value: inlineValue, consumed: 0 };
    }

    if (!nextValue) {
      fail(`Missing value after ${flag}.`);
    }

    return { value: nextValue, consumed: 1 };
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const [flag, inlineValue] =
      arg.startsWith("--") && arg.includes("=")
        ? [arg.slice(0, arg.indexOf("=")), arg.slice(arg.indexOf("=") + 1)]
        : [arg, undefined];

    const valued = { "--version": "version", "--from-tag": "fromTag", "--out-dir": "outDir" };

    if (Object.hasOwn(valued, flag)) {
      const { value, consumed } = takeValue(flag, inlineValue, args[i + 1]);
      parsed[valued[flag]] = value;
      i += consumed;
      continue;
    }

    switch (flag) {
      case "--help":
      case "-h":
        parsed.help = true;
        continue;
      case "--dry-run":
        parsed.dryRun = true;
        continue;
      case "--json":
        parsed.json = true;
        continue;
      default:
        fail(`Unknown argument "${arg}". Run with --help for usage.`);
    }
  }

  if (parsed.version && parsed.fromTag) {
    fail("--version and --from-tag both set the version. Pick one.");
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function mcpbFileName(version) {
  return `${PACKAGE_NAME}-v${version}.mcpb`;
}

/**
 * Everything that has to hold before a bundle is worth shipping. Returns all
 * problems at once rather than stopping at the first.
 *
 * `exists` answers "is this name in the staged payload" so the check runs
 * against what will actually be in the zip, not against the source tree.
 */
export function validatePayload({ manifest, packageVersion, exists }) {
  const problems = [];

  if (!manifest || typeof manifest !== "object") {
    return ["mcp/manifest.json is missing or is not an object."];
  }

  if (!manifest.version) {
    problems.push("mcp/manifest.json has no version.");
  } else if (packageVersion && manifest.version !== packageVersion) {
    // bump-version.mjs keeps these in sync; a mismatch means something wrote
    // one without the other, and Claude Desktop would report the manifest's.
    problems.push(
      `Version mismatch: manifest.json says ${manifest.version}, package.json says ${packageVersion}. Run the bump script.`
    );
  }

  const entryPoint = manifest.server?.entry_point;

  if (!entryPoint) {
    problems.push("mcp/manifest.json declares no server.entry_point.");
  } else if (!exists(entryPoint)) {
    problems.push(`Entry point "${entryPoint}" is declared in the manifest but not in the payload.`);
  }

  if (manifest.icon && !exists(manifest.icon)) {
    problems.push(`Icon "${manifest.icon}" is declared in the manifest but not in the payload.`);
  }

  return problems;
}

// ---------------------------------------------------------------------------
// Staging
// ---------------------------------------------------------------------------

function shouldSkip(sourcePath) {
  const base = path.basename(sourcePath);

  if (EXCLUDED_DIRS.has(base)) {
    return true;
  }

  return EXCLUDED_SUFFIXES.some((suffix) => base.endsWith(suffix));
}

/** Copy the payload into a clean staging directory; returns the names staged. */
function stagePayload(stageDir, { dryRun }) {
  const staged = [];
  const skipped = [];

  if (!dryRun) {
    rmSync(stageDir, { recursive: true, force: true });
    mkdirSync(stageDir, { recursive: true });
  }

  for (const { name, required } of PAYLOAD_FILES) {
    const source = path.join(MCP_DIR, name);

    if (!existsSync(source)) {
      if (required) {
        fail(`Required file mcp/${name} is missing — refusing to ship an incomplete bundle.`);
      }

      skipped.push(name);
      continue;
    }

    if (!dryRun) {
      cpSync(source, path.join(stageDir, name));
    }

    staged.push(name);
  }

  for (const pkg of PAYLOAD_PACKAGES) {
    const source = path.join(MCP_DIR, pkg);

    if (!existsSync(source) || !statSync(source).isDirectory()) {
      fail(`Required package mcp/${pkg}/ is missing — the server would not import.`);
    }

    if (!dryRun) {
      cpSync(source, path.join(stageDir, pkg), {
        recursive: true,
        filter: (src) => !shouldSkip(src),
      });
    }

    staged.push(`${pkg}/`);
  }

  return { staged, skipped };
}

// ---------------------------------------------------------------------------
// Zipping
// ---------------------------------------------------------------------------

/**
 * The archiver to use. `zip` on macOS/Linux and on GitHub's runners;
 * Compress-Archive is the Windows fallback. Node has no zip writer built in and
 * this toolchain takes no dependencies, so shelling out to a battle-tested
 * archiver beats hand-rolling the container format for a file Claude Desktop
 * has to be able to open.
 */
export function pickArchiver({ has = (tool) => spawnSync(tool, ["--version"], { stdio: "ignore" }).status === 0 } = {}) {
  if (has("zip")) {
    return "zip";
  }

  if (process.platform === "win32" && has("powershell")) {
    return "powershell";
  }

  return null;
}

export function archiveCommand(archiver, { outPath }) {
  if (archiver === "zip") {
    // -r recurse, -9 max compression, -X drop platform extras so the archive is
    // reproducible, and belt-and-braces excludes for anything that slipped in.
    return ["zip", ["-r", "-9", "-X", "-q", outPath, ".", "-x", "*/__pycache__/*", "-x", "*.pyc"]];
  }

  if (archiver === "powershell") {
    return [
      "powershell",
      ["-NoProfile", "-Command", `Compress-Archive -Path * -DestinationPath '${outPath}' -Force`],
    ];
  }

  fail(`Unsupported archiver "${archiver}".`);
}

/** Read the archive back and list its entries, so a broken zip fails here. */
function verifyArchive(outPath) {
  const result = spawnSync("unzip", ["-l", outPath], { encoding: "utf8" });

  if (result.status !== 0) {
    // unzip is not everywhere; absence is not evidence of a bad archive.
    return null;
  }

  const entries = result.stdout
    .split("\n")
    .map((line) => line.match(/^\s+\d+\s+\S+\s+\S+\s+(.+)$/)?.[1])
    .filter((name) => name && name !== "Name");

  if (!entries.includes("manifest.json")) {
    fail(`The built bundle has no manifest.json at its root — Claude Desktop would reject it.`);
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Version resolution
// ---------------------------------------------------------------------------

function readJson(absPath) {
  return JSON.parse(readFileSync(absPath, "utf8"));
}

function resolveVersion(args) {
  if (args.version) {
    return args.version;
  }

  if (args.fromTag) {
    const output = execFileSync(process.execPath, [RELEASE_SCRIPT, "--from-tag", args.fromTag, "--json"], {
      cwd: ROOT_DIR,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    const plan = JSON.parse(output);
    const mcp = plan.packages.find((pkg) => pkg.key === "mcp");

    if (!mcp) {
      fail(`Tag ${args.fromTag} does not cover the mcp package.`);
    }

    return mcp.nextVersion ?? mcp.currentVersion;
  }

  return readJson(path.join(MCP_DIR, "package.json")).version;
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

  if (!existsSync(MCP_DIR)) {
    fail("mcp/ does not exist.");
  }

  const version = resolveVersion(args);
  const packageVersion = readJson(path.join(MCP_DIR, "package.json")).version;
  const manifest = readJson(path.join(MCP_DIR, "manifest.json"));

  const stageDir = path.join(MCP_DIR, "build", PACKAGE_NAME);
  const outDir = args.outDir ? path.resolve(ROOT_DIR, args.outDir) : path.join(MCP_DIR, "releases");
  const outPath = path.join(outDir, mcpbFileName(version));

  const log = args.json ? () => {} : console.log;

  log(`📦 MCPB package\n`);
  log(`   version : ${version}`);
  log(`   output  : ${path.relative(ROOT_DIR, outPath)}`);

  const { staged, skipped } = stagePayload(stageDir, { dryRun: args.dryRun });

  // Validate against what was staged, not against mcp/ — that is what ships.
  const stagedNames = new Set(staged.map((name) => name.replace(/\/$/, "")));
  const problems = validatePayload({
    manifest,
    packageVersion: args.version ? null : packageVersion,
    exists: (name) => stagedNames.has(name),
  });

  if (problems.length > 0) {
    console.error("❌ Refusing to build an invalid bundle:");
    problems.forEach((problem) => console.error(`   • ${problem}`));
    process.exitCode = 1;
    return;
  }

  log(`\n   Payload (${staged.length}):`);
  staged.forEach((name) => log(`     ${name}`));

  if (skipped.length > 0) {
    log(`\n   Not present, skipped: ${skipped.join(", ")}`);
  }

  if (args.dryRun) {
    log("\n📋 Dry run — nothing written.");

    if (args.json) {
      console.log(JSON.stringify({ version, path: path.relative(ROOT_DIR, outPath), dryRun: true, payload: staged }, null, 2));
    }

    return;
  }

  const archiver = pickArchiver();

  if (!archiver) {
    fail("No archiver found. Install `zip` (macOS/Linux) — it is what builds the .mcpb.");
  }

  mkdirSync(outDir, { recursive: true });
  rmSync(outPath, { force: true });

  const [command, commandArgs] = archiveCommand(archiver, { outPath });
  const result = spawnSync(command, commandArgs, { cwd: stageDir, stdio: "inherit" });

  if (result.status !== 0) {
    fail(`${command} failed while building the bundle.`);
  }

  const entries = verifyArchive(outPath);
  const sizeKb = Math.round(statSync(outPath).size / 1024);

  log(`\n✅ Built ${path.relative(ROOT_DIR, outPath)} (${sizeKb} KB${entries ? `, ${entries.length} entries` : ""})`);

  // CI reads this to attach the file to the GitHub Release.
  if (process.env.GITHUB_OUTPUT) {
    writeFileSync(
      process.env.GITHUB_OUTPUT,
      `path=${path.relative(ROOT_DIR, outPath)}\nversion=${version}\nsize_kb=${sizeKb}\n`,
      { flag: "a" }
    );
  }

  if (args.json) {
    console.log(
      JSON.stringify(
        { version, path: path.relative(ROOT_DIR, outPath), sizeKb, entries: entries?.length ?? null, payload: staged },
        null,
        2
      )
    );
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
    if (error instanceof McpbError) {
      console.error(`❌ Error: ${error.message}`);
    } else {
      console.error("❌ Fatal error:", error.message);
    }

    process.exit(1);
  }
}
