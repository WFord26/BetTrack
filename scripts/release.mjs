#!/usr/bin/env node

/**
 * BetTrack release.
 *
 * One implementation, run from a laptop or from CI:
 *
 *   npm run release                    # whole repo, dated tag (2026.08.18)
 *   npm run release -- mcp             # just the MCP server (mcp-v1.1.0)
 *   npm run release -- backend         # just the backend (backend-v0.5.1)
 *   npm run release -- --dry-run       # print the whole plan, write nothing
 *
 * The sequence is: preflight → capture release notes → bump → resolve tag →
 * update root CHANGELOG.md → commit → tag → push. Publishing (npm, Docker,
 * GitHub Release) stays in CI, which reads this script's plan output to decide
 * which artifacts a given release actually needs.
 *
 * Version levels are never decided here — `bump-version.mjs --json` resolves
 * them from each package's changelog, so there is exactly one place that maps
 * "what changed" onto "how much does the version move".
 */

import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath, pathToFileURL } from "node:url";
import { realpathSync } from "node:fs";

import { extractUnreleasedSection, getTodayDate } from "./bump-version.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const BUMP_SCRIPT = path.join(SCRIPT_DIR, "bump-version.mjs");
const ROOT_CHANGELOG = path.join(ROOT_DIR, "CHANGELOG.md");

const DEFAULT_BRANCH = "main";

// ---------------------------------------------------------------------------
// Scopes
// ---------------------------------------------------------------------------

/**
 * What a release can cover. `packages` are bump-version.mjs keys; `versionFrom`
 * is the package whose new version names the tag; `artifacts` is what CI should
 * build and publish for this scope.
 */
const SCOPES = {
  all: {
    aliases: ["all", "full", "repo", "everything"],
    title: "Full release",
    packages: ["mcp", "dashboard/backend", "dashboard/frontend", "dashboard"],
    versionFrom: null, // dated tag
    artifacts: ["mcpb", "npm-backend", "npm-frontend", "docker-backend", "docker-frontend", "zip-backend", "zip-frontend"],
  },
  mcp: {
    aliases: ["mcp", "server"],
    title: "MCP server release",
    packages: ["mcp"],
    versionFrom: "mcp",
    artifacts: ["mcpb"],
  },
  dashboard: {
    aliases: ["dashboard", "web"],
    title: "Dashboard release",
    packages: ["dashboard/backend", "dashboard/frontend", "dashboard"],
    versionFrom: "dashboard",
    artifacts: ["npm-backend", "npm-frontend", "docker-backend", "docker-frontend", "zip-backend", "zip-frontend"],
  },
  backend: {
    aliases: ["backend", "be", "api"],
    title: "Backend release",
    packages: ["dashboard/backend"],
    versionFrom: "dashboard/backend",
    artifacts: ["npm-backend", "docker-backend", "zip-backend"],
  },
  frontend: {
    aliases: ["frontend", "fe", "ui"],
    title: "Frontend release",
    packages: ["dashboard/frontend"],
    versionFrom: "dashboard/frontend",
    artifacts: ["npm-frontend", "docker-frontend", "zip-frontend"],
  },
};

/** Section heading each package gets in the aggregated release notes. */
const COMPONENT_TITLES = {
  mcp: "MCP Server",
  "dashboard/backend": "Backend",
  "dashboard/frontend": "Frontend",
  dashboard: "Dashboard",
};

/** Short label used in the `### Packages` summary block. */
const COMPONENT_LABELS = {
  mcp: "MCP",
  "dashboard/backend": "Backend",
  "dashboard/frontend": "Frontend",
  dashboard: "Dashboard",
};

const BUMP_LEVELS = ["patch", "minor", "major"];

// ---------------------------------------------------------------------------
// Errors and output
// ---------------------------------------------------------------------------

export class ReleaseError extends Error {}

function fail(message) {
  throw new ReleaseError(message);
}

function printUsage() {
  console.log(
    `
Usage:
  npm run release                      Release everything under a dated tag
  npm run release -- <scope>           Release one component
  npm run release -- --dry-run         Print the plan, write nothing

Scopes:
  all         everything, tagged yyyy.mm.dd[.N]   (aliases: full, repo)
  mcp         the MCP server, tagged mcp-vX.Y.Z   (aliases: server)
  dashboard   backend + frontend + wrapper        (aliases: web)
  backend     the backend only                    (aliases: be, api)
  frontend    the frontend only                   (aliases: fe, ui)

Options:
  --dry-run           Compute and print everything, write nothing
  --bump <level>      Force patch|minor|major instead of the changelog's verdict
  --push              Push the release commit and tag (implied by --ci)
  --ci                Non-interactive: no prompts, push, emit GitHub outputs
  --branch <name>     Branch releases are allowed from (default: ${DEFAULT_BRANCH})
  --allow-dirty       Skip the clean-working-tree check
  --allow-empty-notes Release even when no package has [Unreleased] entries
  --skip-preflight    Skip every safety check (use with care)
  --json              Emit the resolved plan as JSON and exit, writing nothing
  --from-tag <tag>    Report the scope and artifacts an existing tag implies
  --help, -h          Show this message

Examples:
  npm run release -- --dry-run
  npm run release -- mcp
  npm run release -- backend --bump minor
  npm run release -- --ci
`.trim()
  );
}

// ---------------------------------------------------------------------------
// Shell helpers
// ---------------------------------------------------------------------------

function runGit(args, { allowFailure = false } = {}) {
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

    const details = error.stderr?.toString().trim();
    fail(`git ${args.join(" ")} failed${details ? `: ${details}` : "."}`);
  }
}

function runNode(args, { capture = true } = {}) {
  return execFileSync(process.execPath, args, {
    cwd: ROOT_DIR,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : ["ignore", "inherit", "inherit"],
  });
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

export function resolveScope(token) {
  const normalized = String(token).trim().toLowerCase();

  for (const [name, scope] of Object.entries(SCOPES)) {
    if (scope.aliases.includes(normalized)) {
      return name;
    }
  }

  fail(`Unknown release scope "${token}". Expected one of: ${Object.keys(SCOPES).join(", ")}.`);
}

export function parseArgs(args) {
  const parsed = {
    scope: null,
    bump: null,
    dryRun: false,
    push: false,
    ci: false,
    branch: DEFAULT_BRANCH,
    allowDirty: false,
    allowEmptyNotes: false,
    skipPreflight: false,
    json: false,
    fromTag: null,
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

    switch (flag) {
      case "--help":
      case "-h":
        parsed.help = true;
        continue;
      case "--dry-run":
        parsed.dryRun = true;
        continue;
      case "--push":
        parsed.push = true;
        continue;
      case "--ci":
        parsed.ci = true;
        parsed.push = true;
        continue;
      case "--allow-dirty":
        parsed.allowDirty = true;
        continue;
      case "--allow-empty-notes":
        parsed.allowEmptyNotes = true;
        continue;
      case "--skip-preflight":
        parsed.skipPreflight = true;
        continue;
      case "--json":
        parsed.json = true;
        continue;
      case "--from-tag": {
        const { value, consumed } = takeValue(flag, inlineValue, args[i + 1], "tag name");
        parsed.fromTag = value;
        i += consumed;
        continue;
      }
      case "--bump": {
        const { value, consumed } = takeValue(flag, inlineValue, args[i + 1], "bump level");
        parsed.bump = value;
        i += consumed;
        continue;
      }
      case "--branch": {
        const { value, consumed } = takeValue(flag, inlineValue, args[i + 1], "branch name");
        parsed.branch = value;
        i += consumed;
        continue;
      }
      default:
        break;
    }

    if (arg.startsWith("-")) {
      fail(`Unknown argument "${arg}". Run with --help for usage.`);
    }

    if (parsed.scope) {
      fail(`Only one scope may be given (already have "${parsed.scope}", then "${arg}").`);
    }

    parsed.scope = resolveScope(arg);
  }

  if (parsed.bump && !BUMP_LEVELS.includes(parsed.bump)) {
    fail(`Invalid bump level "${parsed.bump}". Expected ${BUMP_LEVELS.join("|")}.`);
  }

  if (parsed.fromTag) {
    const scope = scopeFromTag(parsed.fromTag);

    if (!scope) {
      fail(`Tag "${parsed.fromTag}" does not name a release scope.`);
    }

    if (parsed.scope && parsed.scope !== scope) {
      fail(`Tag "${parsed.fromTag}" is a ${scope} release, but scope "${parsed.scope}" was given.`);
    }

    parsed.scope = scope;
    // Reading an existing tag is a query about a release that already happened.
    parsed.dryRun = true;
  }

  parsed.scope ??= "all";

  // --json and --dry-run are both read-only; neither should ever prompt.
  if (parsed.json) {
    parsed.dryRun = true;
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// Tag resolution
// ---------------------------------------------------------------------------

function tagExists(tag, { checkRemote = true } = {}) {
  if (runGit(["rev-parse", "--verify", "--quiet", `refs/tags/${tag}`], { allowFailure: true })) {
    return "local";
  }

  if (!checkRemote) {
    return null;
  }

  const remote = runGit(["ls-remote", "--tags", "origin", `refs/tags/${tag}`], { allowFailure: true });

  // null means the command failed outright (offline, no remote) — not proof of
  // absence, so say so rather than reporting a clean slate.
  if (remote === null) {
    return "unknown";
  }

  return remote.includes(`refs/tags/${tag}`) ? "remote" : null;
}

/**
 * `yyyy.mm.dd`, then `yyyy.mm.dd.1`, `.2`, … Dotted rather than dashed so the
 * result matches the tag patterns release.yml already triggers on.
 */
export function nextDatedTag(today, tagTaken) {
  if (!tagTaken(today)) {
    return today;
  }

  for (let suffix = 1; suffix < 100; suffix += 1) {
    const candidate = `${today}.${suffix}`;
    if (!tagTaken(candidate)) {
      return candidate;
    }
  }

  fail(`Could not find a free release tag for ${today} (tried .1 through .99).`);
}

/**
 * The inverse of the tag naming above: given a pushed tag, say which scope it
 * represents so a tag-triggered workflow builds exactly the right artifacts.
 * Returns null for a tag this project did not create.
 */
export function scopeFromTag(tag) {
  const dated = /^\d+\.\d+\.\d+(\.\d+)?$/;

  if (dated.test(tag)) {
    return "all";
  }

  const match = String(tag).match(/^([a-z]+)-v\d+\.\d+\.\d+/i);

  if (!match) {
    return null;
  }

  const name = match[1].toLowerCase();
  return Object.hasOwn(SCOPES, name) ? name : null;
}

export function componentTag(scopeName, version) {
  const slug = scopeName === "all" ? "release" : scopeName;
  return `${slug}-v${version}`;
}

// ---------------------------------------------------------------------------
// Release notes
// ---------------------------------------------------------------------------

/**
 * Package changelog bodies carry their own `### Added` / `### Fixed` headings.
 * They sit one level down inside the root changelog's release block, so demote
 * them to keep the document's heading hierarchy intact.
 */
export function demoteHeadings(body) {
  return body
    .split("\n")
    .map((line) => (/^#{2,5}\s/.test(line) ? `#${line}` : line))
    .join("\n");
}

/**
 * Assemble the root CHANGELOG.md block (and GitHub Release body) from the
 * `[Unreleased]` sections captured before the bump.
 */
export function renderReleaseNotes({ tag, entries, projectNotes }) {
  const lines = [`## [${tag}]`, ""];

  const versioned = entries.filter((entry) => entry.nextVersion);

  if (versioned.length > 0) {
    lines.push("### Packages", "");
    for (const entry of versioned) {
      lines.push(`- **${COMPONENT_LABELS[entry.key] ?? entry.key}:** v${entry.nextVersion}`);
    }
    lines.push("");
  }

  if (projectNotes?.trim()) {
    lines.push("### Project", "", demoteHeadings(projectNotes.trim()), "");
  }

  for (const entry of entries) {
    if (!entry.notes?.trim()) {
      continue;
    }

    lines.push(`### ${COMPONENT_TITLES[entry.key] ?? entry.key}`, "", demoteHeadings(entry.notes.trim()), "");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

/**
 * Insert a release block under `[Unreleased]`, clearing whatever was in
 * `[Unreleased]` (it has been rolled into the block by the caller).
 */
export function renderRootChangelog(content, block, { clearUnreleased = true } = {}) {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((line) => /^## \[Unreleased\]/i.test(line));

  if (start === -1) {
    return { content, changed: false };
  }

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^## /.test(lines[i]) || /^---\s*$/.test(lines[i])) {
      end = i;
      break;
    }
  }

  // A component release records itself without consuming the project notes, so
  // the [Unreleased] body survives above the new block.
  const head = clearUnreleased ? lines.slice(0, start + 1) : lines.slice(0, end);
  const tail = lines.slice(end);
  const rebuilt = [...head, "", "---", "", block.trimEnd(), "", ...tail];

  return { content: `${rebuilt.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`, changed: true };
}

function readChangelogSection(relPath) {
  const abs = path.join(ROOT_DIR, relPath);

  if (!existsSync(abs)) {
    return "";
  }

  return extractUnreleasedSection(readFileSync(abs, "utf8")) ?? "";
}

/** The changelog that belongs to a bump-version.mjs package key. */
function changelogPathFor(manifestPath) {
  return path.posix.join(path.posix.dirname(manifestPath), "CHANGELOG.md");
}

// ---------------------------------------------------------------------------
// Preflight
// ---------------------------------------------------------------------------

export function evaluatePreflight({ branch, currentBranch, dirty, behind, tagState, hasNotes }, options) {
  const problems = [];
  const warnings = [];

  if (currentBranch !== branch) {
    problems.push(`On branch "${currentBranch}", but releases must come from "${branch}". Use --branch to override.`);
  }

  if (dirty && !options.allowDirty) {
    problems.push("Working tree is dirty. Commit or stash first, or pass --allow-dirty.");
  }

  if (behind === null) {
    warnings.push("Could not reach origin — skipped the up-to-date check.");
  } else if (behind > 0) {
    problems.push(`Local branch is ${behind} commit(s) behind origin/${branch}. Pull first.`);
  }

  if (tagState === "local" || tagState === "remote") {
    problems.push(`Release tag already exists (${tagState}). Nothing to do.`);
  } else if (tagState === "unknown") {
    warnings.push("Could not reach origin — could not confirm the tag is free remotely.");
  }

  if (!hasNotes && !options.allowEmptyNotes) {
    problems.push(
      "No [Unreleased] entries in any package changelog — there is nothing to release. Pass --allow-empty-notes to override."
    );
  }

  return { problems, warnings };
}

function gatherPreflightFacts(branch, tag) {
  const currentBranch = runGit(["rev-parse", "--abbrev-ref", "HEAD"], { allowFailure: true }) ?? "";
  const dirty = Boolean(runGit(["status", "--porcelain"], { allowFailure: true }));

  // Best-effort: a missing network must not turn into a hard failure.
  const fetched = runGit(["fetch", "--quiet", "origin", branch], { allowFailure: true });
  let behind = null;

  if (fetched !== null) {
    const count = runGit(["rev-list", "--count", `HEAD..origin/${branch}`], { allowFailure: true });
    behind = count === null ? null : Number(count);
  }

  return { currentBranch, dirty, behind, tagState: tagExists(tag) };
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

function bumpPlanFor(packageKeys, level) {
  const targets = packageKeys.map((key) => (level ? `${key}:${level}` : key));
  const output = runNode([BUMP_SCRIPT, ...targets, "--json"]);

  try {
    return JSON.parse(output);
  } catch {
    fail(`Could not parse the bump plan. bump-version.mjs said:\n${output}`);
  }
}

function buildPlan(args) {
  const scope = SCOPES[args.scope];
  const bumpPlan = bumpPlanFor(scope.packages, args.bump);
  const selected = bumpPlan.packages.filter((pkg) => pkg.selected);

  const entries = selected.map((pkg) => ({
    key: pkg.key,
    name: pkg.name,
    currentVersion: pkg.currentVersion,
    // At an existing tag the manifests already hold the released versions, so
    // there is no "next" — reporting one would invent a bump that never happened.
    nextVersion: args.fromTag ? pkg.currentVersion : pkg.nextVersion,
    level: pkg.level,
    levelSource: pkg.levelSource,
    changelogPath: changelogPathFor(pkg.manifestPath),
    notes: readChangelogSection(changelogPathFor(pkg.manifestPath)),
  }));

  // Only a full release consumes the root [Unreleased]. Those entries describe
  // repo-wide work, so a narrow `release -- mcp` must leave them for the next
  // full release rather than silently swallowing them.
  const projectNotes = args.scope === "all" ? readChangelogSection("CHANGELOG.md") : "";

  const versionSource = scope.versionFrom
    ? entries.find((entry) => entry.key === scope.versionFrom)
    : null;

  if (scope.versionFrom && !versionSource) {
    fail(`Scope "${args.scope}" expected package ${scope.versionFrom} in the bump plan, but it was not selected.`);
  }

  const tag = args.fromTag
    ? args.fromTag
    : scope.versionFrom
      ? componentTag(args.scope, versionSource.nextVersion)
      : nextDatedTag(getTodayDate().replace(/-/g, "."), (candidate) => tagExists(candidate) !== null);

  const hasNotes = entries.some((entry) => entry.notes.trim()) || Boolean(projectNotes.trim());

  return { scope, scopeName: args.scope, tag, entries, projectNotes, hasNotes, artifacts: scope.artifacts };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function reportPlan(plan) {
  console.log(`🚢 ${plan.scope.title}`);
  console.log(`   tag: ${plan.tag}\n`);

  console.log("   Versions:");
  for (const entry of plan.entries) {
    console.log(
      `     ${entry.key.padEnd(20)} ${entry.currentVersion} → ${entry.nextVersion}  (${entry.level} — ${entry.levelSource})`
    );
  }

  console.log("\n   Release notes from:");
  const contributing = plan.entries.filter((entry) => entry.notes.trim());

  if (plan.projectNotes.trim()) {
    console.log(`     CHANGELOG.md (project)`);
  }

  if (contributing.length === 0 && !plan.projectNotes.trim()) {
    console.log("     (none — no [Unreleased] entries anywhere)");
  }

  for (const entry of contributing) {
    const count = entry.notes.trim().split("\n").filter((line) => /^\s*[-*]/.test(line)).length;
    console.log(`     ${entry.changelogPath} (${count} entr${count === 1 ? "y" : "ies"})`);
  }

  console.log(`\n   Artifacts CI will build: ${plan.artifacts.join(", ")}`);
}

// ---------------------------------------------------------------------------
// Confirmation
// ---------------------------------------------------------------------------

function confirm(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`${question} [y/N] `, (answer) => {
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

function applyBump(packageKeys, level) {
  const targets = packageKeys.map((key) => (level ? `${key}:${level}` : key));
  runNode([BUMP_SCRIPT, ...targets, "--no-input"], { capture: false });
}

function writeRootChangelog(plan) {
  if (!existsSync(ROOT_CHANGELOG)) {
    return false;
  }

  const block = renderReleaseNotes({
    tag: plan.tag,
    entries: plan.entries,
    projectNotes: plan.projectNotes,
  });

  const { content, changed } = renderRootChangelog(readFileSync(ROOT_CHANGELOG, "utf8"), block, {
    clearUnreleased: plan.scopeName === "all",
  });

  if (changed) {
    writeFileSync(ROOT_CHANGELOG, content, "utf8");
  }

  return changed;
}

function commitAndTag(plan, { allowDirty = false } = {}) {
  const summary = plan.entries.map((entry) => `- ${entry.key}: v${entry.nextVersion}`).join("\n");
  const message = `chore(release): ${plan.tag}\n\n${summary}`;

  // Preflight normally guarantees the only changes here are the bump's own.
  // With --allow-dirty that guarantee is gone, so say what is about to be swept
  // into the release commit rather than doing it silently.
  if (allowDirty) {
    const staged = runGit(["status", "--porcelain"], { allowFailure: true });
    if (staged) {
      console.log("   ⚠️  --allow-dirty: committing every change in the tree:");
      staged.split(/\r?\n/).slice(0, 20).forEach((line) => console.log(`      ${line}`));
    }
  }

  runGit(["add", "-A"]);

  if (runGit(["diff", "--cached", "--quiet"], { allowFailure: true }) === null) {
    runGit(["commit", "-m", message]);
  } else {
    console.log("   (nothing staged to commit)");
  }

  runGit(["tag", "-a", plan.tag, "-m", `Release ${plan.tag}`]);
}

function emitCiOutputs(plan) {
  const outputPath = process.env.GITHUB_OUTPUT;

  if (!outputPath) {
    return;
  }

  const lines = [
    `release_tag=${plan.tag}`,
    `scope=${plan.scopeName}`,
    `artifacts=${plan.artifacts.join(",")}`,
  ];

  for (const entry of plan.entries) {
    const key = entry.key.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
    lines.push(`version_${key}=${entry.nextVersion}`);
  }

  for (const artifact of plan.artifacts) {
    lines.push(`build_${artifact.replace(/-/g, "_")}=true`);
  }

  const notes = renderReleaseNotes({ tag: plan.tag, entries: plan.entries, projectNotes: plan.projectNotes });
  lines.push(`release_notes<<RELEASE_NOTES_EOF\n${notes}\nRELEASE_NOTES_EOF`);

  appendFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
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

  const plan = buildPlan(args);

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          scope: plan.scopeName,
          tag: plan.tag,
          artifacts: plan.artifacts,
          packages: plan.entries.map(({ notes, ...rest }) => ({ ...rest, hasNotes: Boolean(notes.trim()) })),
          notes: renderReleaseNotes({ tag: plan.tag, entries: plan.entries, projectNotes: plan.projectNotes }),
        },
        null,
        2
      )
    );
    return;
  }

  reportPlan(plan);

  if (!args.skipPreflight) {
    const facts = gatherPreflightFacts(args.branch, plan.tag);
    const { problems, warnings } = evaluatePreflight(
      { branch: args.branch, hasNotes: plan.hasNotes, ...facts },
      args
    );

    if (warnings.length > 0) {
      console.log("");
      warnings.forEach((warning) => console.log(`   ⚠️  ${warning}`));
    }

    if (problems.length > 0) {
      console.error("\n❌ Preflight failed:");
      problems.forEach((problem) => console.error(`   • ${problem}`));
      process.exitCode = 1;
      return;
    }

    console.log("\n   ✅ Preflight passed");
  }

  if (args.dryRun) {
    console.log("\n📋 Dry run — nothing written. Release notes would be:\n");
    console.log(
      renderReleaseNotes({ tag: plan.tag, entries: plan.entries, projectNotes: plan.projectNotes })
        .split("\n")
        .map((line) => `   │ ${line}`)
        .join("\n")
    );
    return;
  }

  if (!args.ci && process.stdin.isTTY && process.stdout.isTTY) {
    const action = args.push ? "bump, commit, tag, and PUSH" : "bump, commit, and tag";
    if (!(await confirm(`\nProceed to ${action} ${plan.tag}?`))) {
      console.log("🚫 Cancelled — nothing written.");
      return;
    }
  }

  console.log("\n📦 Bumping versions...");
  applyBump(plan.scope.packages, args.bump);

  console.log("\n📝 Updating root CHANGELOG.md...");
  console.log(writeRootChangelog(plan) ? "   ✅ Updated" : "   ⏭️  Skipped (no [Unreleased] section)");

  console.log("\n🔖 Committing and tagging...");
  commitAndTag(plan, { allowDirty: args.allowDirty });
  console.log(`   ✅ ${plan.tag}`);

  emitCiOutputs(plan);

  if (!args.push) {
    console.log("\n💡 Push when ready:");
    console.log(`   git push origin HEAD && git push origin ${plan.tag}`);
    return;
  }

  console.log("\n🚀 Pushing...");
  runGit(["push", "origin", "HEAD"]);
  runGit(["push", "origin", plan.tag]);
  console.log(`   ✅ Pushed ${plan.tag} — CI will build: ${plan.artifacts.join(", ")}`);
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
  main().catch((error) => {
    if (error instanceof ReleaseError) {
      console.error(`❌ Error: ${error.message}`);
    } else {
      console.error("❌ Fatal error:", error.message);
    }

    process.exit(1);
  });
}
