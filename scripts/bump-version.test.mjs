/**
 * Tests for the version bump script.
 *
 * Run with: npm run test:bump  (from dashboard/), or `node --test scripts/*.test.mjs`.
 * Uses only node:test — the script has no dependencies and neither does this.
 *
 * Unit tests import the script's exported pure functions. The end-to-end tests
 * build a throwaway repo in a temp directory, copy the real script into it, and
 * run it as a subprocess, so they exercise the actual CLI including file writes.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  BumpError,
  bumpSemver,
  buildPlan,
  extractUnreleasedSection,
  getTodayDate,
  inferLevelFromChangelog,
  maxLevel,
  parseArgs,
  renderChangelogRelease,
  resolvePackageKey,
  tagNameFor,
  updateDependencySpecifier,
} from "./bump-version.mjs";

const SCRIPT_PATH = fileURLToPath(new URL("./bump-version.mjs", import.meta.url));

// ---------------------------------------------------------------------------
// Changelog fixtures — shaped like the real BetTrack changelogs
// ---------------------------------------------------------------------------

const CHANGELOG_HEADER = `# Changelog

All notable changes to this package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
`;

function changelog(unreleasedBody, { released = true } = {}) {
  const tail = released
    ? `
---

## [0.1.0] - 2026-01-01

### Added

- Initial release
`
    : "";

  return `${CHANGELOG_HEADER}
## [Unreleased]
${unreleasedBody}${tail}`;
}

// ---------------------------------------------------------------------------
// Level inference
// ---------------------------------------------------------------------------

describe("inferLevelFromChangelog", () => {
  it("returns minor when [Unreleased] has a populated Added section", () => {
    const content = changelog(`
### Changed

- Refactored the odds poller

### Added

- New \`/api/mcp/analytics\` surface
`);

    const result = inferLevelFromChangelog(content);
    assert.equal(result.level, "minor");
    assert.match(result.reason, /Added/);
  });

  it("returns patch when only Changed/Fixed sections are populated", () => {
    const content = changelog(`
### Changed

- Split the arbitrage service

### Fixed

- CLV closing-line defect
`);

    assert.equal(inferLevelFromChangelog(content).level, "patch");
  });

  it("returns major for a populated Removed section, outranking Added", () => {
    const content = changelog(`
### Added

- A new formatter

### Removed

- Dropped the legacy \`/v1/odds\` endpoint
`);

    const result = inferLevelFromChangelog(content);
    assert.equal(result.level, "major");
    assert.match(result.reason, /Removed/);
  });

  it("returns major on a BREAKING CHANGE marker even with only a Fixed section", () => {
    const content = changelog(`
### Fixed

- BREAKING CHANGE: settle endpoint now requires an explicit stake
`);

    const result = inferLevelFromChangelog(content);
    assert.equal(result.level, "major");
    assert.match(result.reason, /BREAKING/);
  });

  it("ignores section headings that have no entries under them", () => {
    // An empty `### Added` scaffold must not inflate a patch into a minor.
    const content = changelog(`
### Added

### Fixed

- Corrected the parlay payout rounding
`);

    const result = inferLevelFromChangelog(content);
    assert.equal(result.level, "patch");
    assert.match(result.reason, /fixed/);
  });

  it("returns no level for an empty [Unreleased] section", () => {
    const result = inferLevelFromChangelog(changelog("\n"));
    assert.equal(result.level, null);
    assert.match(result.reason, /empty/);
  });

  it("returns no level when there is no [Unreleased] section at all", () => {
    const result = inferLevelFromChangelog(`${CHANGELOG_HEADER}\n## [0.1.0] - 2026-01-01\n\n- Initial\n`);
    assert.equal(result.level, null);
    assert.match(result.reason, /no \[Unreleased\]/);
  });

  it("returns no level for an empty string (package has no changelog)", () => {
    assert.equal(inferLevelFromChangelog("").level, null);
  });

  it("treats bare bullets with no section headings as a patch", () => {
    // The root CHANGELOG.md uses this shape: entries directly under [Unreleased].
    const content = changelog(`
- **Arbitrage & Middle Detection** (Phase 3, issue #9): merged to beta
`);

    assert.equal(inferLevelFromChangelog(content).level, "patch");
  });

  it("does not read sections belonging to an already-released version", () => {
    // [Unreleased] is empty; the Added below belongs to 0.1.0 and must not leak.
    const content = changelog("\n");
    assert.equal(inferLevelFromChangelog(content).level, null);
  });
});

describe("extractUnreleasedSection", () => {
  it("stops at the --- separator", () => {
    const section = extractUnreleasedSection(changelog("\n### Fixed\n\n- one\n"));
    assert.match(section, /### Fixed/);
    assert.doesNotMatch(section, /Initial release/);
  });

  it("stops at the next ## heading when there is no separator", () => {
    const content = `## [Unreleased]\n\n### Fixed\n\n- one\n\n## [0.1.0] - 2026-01-01\n\n### Added\n\n- old\n`;
    const section = extractUnreleasedSection(content);
    assert.match(section, /- one/);
    assert.doesNotMatch(section, /- old/);
  });

  it("returns null when the section is absent", () => {
    assert.equal(extractUnreleasedSection("# Changelog\n\n## [0.1.0]\n"), null);
  });
});

// ---------------------------------------------------------------------------
// Semver
// ---------------------------------------------------------------------------

describe("bumpSemver", () => {
  it("increments the right component per level", () => {
    assert.equal(bumpSemver("0.4.3", "patch"), "0.4.4");
    assert.equal(bumpSemver("0.4.3", "minor"), "0.5.0");
    assert.equal(bumpSemver("0.4.3", "major"), "1.0.0");
  });

  it("resets lower components", () => {
    assert.equal(bumpSemver("1.9.9", "minor"), "1.10.0");
    assert.equal(bumpSemver("1.9.9", "major"), "2.0.0");
  });

  it("drops prerelease and build metadata", () => {
    assert.equal(bumpSemver("1.2.3-beta.1", "patch"), "1.2.4");
    assert.equal(bumpSemver("1.2.3+build5", "minor"), "1.3.0");
  });

  it("rejects non-semver input", () => {
    assert.throws(() => bumpSemver("2026.08.16.1", "patch"), BumpError);
    assert.throws(() => bumpSemver("v1.2.3", "patch"), BumpError);
  });
});

describe("maxLevel", () => {
  it("picks the highest level present", () => {
    assert.equal(maxLevel(["patch", "minor"]), "minor");
    assert.equal(maxLevel(["minor", "major", "patch"]), "major");
    assert.equal(maxLevel(["patch", "patch"]), "patch");
  });

  it("ignores nulls and returns null when nothing is set", () => {
    assert.equal(maxLevel([null, "patch", null]), "patch");
    assert.equal(maxLevel([null, null]), null);
    assert.equal(maxLevel([]), null);
  });
});

describe("updateDependencySpecifier", () => {
  it("preserves the range operator", () => {
    assert.equal(updateDependencySpecifier("^0.4.3", "0.5.0"), "^0.5.0");
    assert.equal(updateDependencySpecifier("~0.4.3", "0.5.0"), "~0.5.0");
    assert.equal(updateDependencySpecifier("0.4.3", "0.5.0"), "0.5.0");
  });

  it("handles workspace protocol forms", () => {
    assert.equal(updateDependencySpecifier("workspace:*", "0.5.0"), "workspace:*");
    assert.equal(updateDependencySpecifier("workspace:^0.4.3", "0.5.0"), "workspace:^0.5.0");
    assert.equal(updateDependencySpecifier("workspace:~0.4.3", "0.5.0"), "workspace:~0.5.0");
    assert.equal(updateDependencySpecifier("workspace:0.4.3", "0.5.0"), "workspace:0.5.0");
  });

  it("leaves specifiers it cannot safely rewrite alone", () => {
    assert.equal(updateDependencySpecifier("file:../backend", "0.5.0"), "file:../backend");
    assert.equal(updateDependencySpecifier(">=1.0.0 <2.0.0", "0.5.0"), ">=1.0.0 <2.0.0");
    assert.equal(updateDependencySpecifier("*", "0.5.0"), "*");
  });
});

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

describe("parseArgs", () => {
  it("parses per-package targets with independent levels", () => {
    const args = parseArgs(["mcp:minor", "frontend:patch"]);
    assert.deepEqual([...args.targets], [
      ["mcp", "minor"],
      ["dashboard/frontend", "patch"],
    ]);
    assert.equal(args.force, null);
  });

  it("records a target with no level as null so the changelog decides", () => {
    const args = parseArgs(["backend"]);
    assert.deepEqual([...args.targets], [["dashboard/backend", null]]);
  });

  it("resolves aliases and full keys to the same package", () => {
    assert.equal(resolvePackageKey("fe"), "dashboard/frontend");
    assert.equal(resolvePackageKey("frontend"), "dashboard/frontend");
    assert.equal(resolvePackageKey("dashboard/frontend"), "dashboard/frontend");
    assert.equal(resolvePackageKey("DASHBOARD/FRONTEND"), "dashboard/frontend");
    assert.equal(resolvePackageKey("dashboard\\backend"), "dashboard/backend");
    assert.equal(resolvePackageKey("dashboard/backend/"), "dashboard/backend");
  });

  it("keeps the aggregate distinct from its members", () => {
    assert.equal(resolvePackageKey("dashboard"), "dashboard");
    assert.equal(resolvePackageKey("monorepo"), "dashboard");
  });

  it("treats a bare level as the legacy global --force", () => {
    assert.equal(parseArgs(["minor"]).force, "minor");
    assert.equal(parseArgs(["--force", "major"]).force, "major");
    assert.equal(parseArgs(["--force=major"]).force, "major");
  });

  it("parses the remaining flags", () => {
    const args = parseArgs(["--dry-run", "--since", "origin/main", "--no-input"]);
    assert.equal(args.dryRun, true);
    assert.equal(args.since, "origin/main");
    assert.equal(args.noInput, true);

    assert.equal(parseArgs(["--since=origin/main"]).since, "origin/main");
    assert.equal(parseArgs(["--tag"]).tagMode, true);
    assert.equal(parseArgs(["--tag", "--allow-dirty"]).allowDirty, true);
    assert.equal(parseArgs(["--help"]).help, true);
  });

  it("lets a later explicit level win over an earlier bare target", () => {
    assert.deepEqual([...parseArgs(["mcp", "mcp:major"]).targets], [["mcp", "major"]]);
  });

  it("keeps an explicit level when the same package is repeated bare", () => {
    assert.deepEqual([...parseArgs(["mcp:major", "mcp"]).targets], [["mcp", "major"]]);
  });

  it("rejects unknown packages, levels, and flags", () => {
    assert.throws(() => parseArgs(["nope"]), BumpError);
    assert.throws(() => parseArgs(["mcp:huge"]), BumpError);
    assert.throws(() => parseArgs(["--nonsense"]), BumpError);
    assert.throws(() => parseArgs(["--force"]), BumpError);
    assert.throws(() => parseArgs(["--force", "huge"]), BumpError);
    assert.throws(() => parseArgs(["--since"]), BumpError);
  });
});

// ---------------------------------------------------------------------------
// Changelog rewriting
// ---------------------------------------------------------------------------

describe("renderChangelogRelease", () => {
  it("moves the unreleased entries under a dated version header", () => {
    const original = changelog(`
### Added

- A thing
`);

    const { content, changed } = renderChangelogRelease(original, "0.5.0", "2026-08-16");

    assert.equal(changed, true);
    assert.match(content, /## \[0\.5\.0\] - 2026-08-16/);
    // The entry now sits under the new header, not under [Unreleased].
    const unreleased = extractUnreleasedSection(content);
    assert.equal(unreleased.trim(), "");
    assert.match(content.slice(content.indexOf("## [0.5.0]")), /- A thing/);
  });

  it("keeps [Unreleased] in place for the next cycle", () => {
    const { content } = renderChangelogRelease(changelog("\n### Fixed\n\n- x\n"), "0.5.0", "2026-08-16");
    assert.match(content, /## \[Unreleased\]/);
    assert.equal(content.indexOf("## [Unreleased]") < content.indexOf("## [0.5.0]"), true);
  });

  it("is a no-op when there is no [Unreleased] section", () => {
    const original = `${CHANGELOG_HEADER}\n## [0.1.0] - 2026-01-01\n\n- Initial\n`;
    const { content, changed } = renderChangelogRelease(original, "0.5.0", "2026-08-16");

    assert.equal(changed, false);
    assert.equal(content, original);
  });
});

describe("getTodayDate", () => {
  it("zero-pads month and day", () => {
    assert.equal(getTodayDate(new Date(2026, 0, 5)), "2026-01-05");
    assert.equal(getTodayDate(new Date(2026, 11, 31)), "2026-12-31");
  });
});

describe("tagNameFor", () => {
  it("uses the last path segment so keys never collide", () => {
    assert.equal(tagNameFor("mcp", "0.4.4"), "mcp-v0.4.4");
    assert.equal(tagNameFor("dashboard/backend", "0.4.3"), "backend-v0.4.3");
    assert.equal(tagNameFor("dashboard/frontend", "0.5.4"), "frontend-v0.5.4");
    assert.equal(tagNameFor("dashboard", "0.2.5"), "dashboard-v0.2.5");
  });

  it("gives every package a distinct tag prefix", () => {
    const tags = ["mcp", "dashboard/backend", "dashboard/frontend", "dashboard"].map((key) =>
      tagNameFor(key, "1.0.0")
    );
    assert.equal(new Set(tags).size, tags.length);
  });
});

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

describe("buildPlan", () => {
  const fakePackages = [
    { key: "mcp", aggregate: false, members: [], manifest: { version: "1.0.0" } },
    { key: "dashboard/backend", aggregate: false, members: [], manifest: { version: "2.0.0" } },
    { key: "dashboard/frontend", aggregate: false, members: [], manifest: { version: "3.0.0" } },
    {
      key: "dashboard",
      aggregate: true,
      members: ["dashboard/backend", "dashboard/frontend"],
      manifest: { version: "4.0.0" },
    },
  ];

  const plan = (options) =>
    buildPlan(fakePackages, {
      changedKeys: new Set(),
      targets: new Map(),
      force: null,
      changelogReader: () => "",
      ...options,
    });

  const rowFor = (rows, key) => rows.find((row) => row.key === key);

  it("selects only the named packages when targets are explicit", () => {
    const rows = plan({
      changedKeys: new Set(["mcp", "dashboard/backend"]),
      targets: new Map([["dashboard/frontend", "minor"]]),
    });

    assert.equal(rowFor(rows, "dashboard/frontend").selected, true);
    assert.equal(rowFor(rows, "mcp").selected, false);
    assert.equal(rowFor(rows, "dashboard/backend").selected, false);
  });

  it("selects every changed package when no targets are given", () => {
    const rows = plan({ changedKeys: new Set(["mcp"]) });

    assert.equal(rowFor(rows, "mcp").selected, true);
    assert.equal(rowFor(rows, "dashboard/backend").selected, false);
  });

  it("selects the aggregate when any member changed", () => {
    const rows = plan({ changedKeys: new Set(["dashboard/frontend"]) });
    assert.equal(rowFor(rows, "dashboard").selected, true);
  });

  it("leaves the aggregate alone when only mcp changed", () => {
    const rows = plan({ changedKeys: new Set(["mcp"]) });
    assert.equal(rowFor(rows, "dashboard").selected, false);
  });

  it("gives the aggregate the highest level of its selected members", () => {
    const rows = plan({
      changedKeys: new Set(["dashboard/backend", "dashboard/frontend"]),
      changelogReader: (pkg) =>
        pkg.key === "dashboard/frontend" ? changelog("\n### Added\n\n- feature\n") : "",
    });

    assert.equal(rowFor(rows, "dashboard/frontend").level, "minor");
    assert.equal(rowFor(rows, "dashboard/backend").level, "patch");
    assert.equal(rowFor(rows, "dashboard").level, "minor");
    assert.match(rowFor(rows, "dashboard").levelSource, /highest of its workspaces/);
  });

  it("prefers the aggregate's own changelog over its members' levels", () => {
    const rows = plan({
      changedKeys: new Set(["dashboard/backend"]),
      changelogReader: (pkg) => (pkg.key === "dashboard" ? changelog("\n### Removed\n\n- gone\n") : ""),
    });

    assert.equal(rowFor(rows, "dashboard").level, "major");
  });

  it("ranks an explicit level above --force, and --force above the changelog", () => {
    const rows = plan({
      changedKeys: new Set(["mcp", "dashboard/backend"]),
      targets: new Map([
        ["mcp", "patch"],
        ["dashboard/backend", null],
      ]),
      force: "major",
      changelogReader: () => changelog("\n### Added\n\n- feature\n"),
    });

    assert.equal(rowFor(rows, "mcp").level, "patch");
    assert.equal(rowFor(rows, "mcp").levelSource, "requested");
    assert.equal(rowFor(rows, "dashboard/backend").level, "major");
    assert.equal(rowFor(rows, "dashboard/backend").levelSource, "--force");
  });

  it("infers each package's level independently from its own changelog", () => {
    const levels = {
      mcp: changelog("\n### Removed\n\n- dropped a tool\n"),
      "dashboard/backend": changelog("\n### Added\n\n- new route\n"),
      "dashboard/frontend": changelog("\n### Fixed\n\n- a bug\n"),
    };

    const rows = plan({
      changedKeys: new Set(Object.keys(levels)),
      changelogReader: (pkg) => levels[pkg.key] ?? "",
    });

    assert.equal(rowFor(rows, "mcp").level, "major");
    assert.equal(rowFor(rows, "dashboard/backend").level, "minor");
    assert.equal(rowFor(rows, "dashboard/frontend").level, "patch");
  });

  it("falls back to patch when a package has no changelog signal", () => {
    const rows = plan({ changedKeys: new Set(["mcp"]) });
    const row = rowFor(rows, "mcp");

    assert.equal(row.level, "patch");
    assert.match(row.levelSource, /default/);
  });
});

// ---------------------------------------------------------------------------
// End-to-end: run the real CLI against a throwaway repo
// ---------------------------------------------------------------------------

const fixtures = [];

after(() => {
  for (const dir of fixtures) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * A minimal BetTrack-shaped repo: the four manifests, their changelogs, one
 * source file per hashed package, and a copy of the script under scripts/ so
 * ROOT_DIR resolves inside the fixture.
 */
function createFixtureRepo({ changelogs = {} } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "bettrack-bump-"));
  fixtures.push(root);

  const write = (relPath, content) => {
    const abs = path.join(root, relPath);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content, "utf8");
  };

  const manifests = {
    "mcp/package.json": { name: "sports-data-mcp", version: "0.4.4" },
    "mcp/manifest.json": { name: "sports-data-mcp", version: "0.4.4" },
    "dashboard/package.json": { name: "sports-betting-dashboard", version: "0.2.5" },
    "dashboard/backend/package.json": { name: "@wford26/bettrack-backend", version: "0.4.3" },
    "dashboard/frontend/package.json": {
      name: "@wford26/bettrack-frontend",
      version: "0.5.4",
      dependencies: { "@wford26/bettrack-backend": "^0.4.3" },
    },
  };

  for (const [relPath, manifest] of Object.entries(manifests)) {
    write(relPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }

  for (const dir of ["mcp", "dashboard", "dashboard/backend", "dashboard/frontend"]) {
    write(`${dir}/CHANGELOG.md`, changelogs[dir] ?? changelog("\n### Fixed\n\n- a fix\n"));
  }

  write("mcp/server.py", "print('mcp')\n");
  write("dashboard/backend/src/index.ts", "export const backend = 1;\n");
  write("dashboard/frontend/src/main.tsx", "export const frontend = 1;\n");

  mkdirSync(path.join(root, "scripts"), { recursive: true });
  cpSync(SCRIPT_PATH, path.join(root, "scripts", "bump-version.mjs"));

  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: root });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: root });
  execFileSync("git", ["add", "-A"], { cwd: root });
  execFileSync("git", ["commit", "-qm", "initial"], { cwd: root });

  return root;
}

function runBump(root, args = []) {
  return execFileSync("node", [path.join(root, "scripts", "bump-version.mjs"), ...args], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function versionOf(root, relPath) {
  return JSON.parse(readFileSync(path.join(root, relPath), "utf8")).version;
}

/** `-a` would miss a freshly created .bump-hashes.json, so stage everything. */
function commitAll(root, message) {
  execFileSync("git", ["add", "-A"], { cwd: root });
  execFileSync("git", ["commit", "-qm", message], { cwd: root });
}

describe("bump CLI (end to end)", () => {
  it("bumps only the named package and leaves the others untouched", () => {
    const root = createFixtureRepo();
    runBump(root, ["mcp:minor"]);

    assert.equal(versionOf(root, "mcp/package.json"), "0.5.0");
    assert.equal(versionOf(root, "dashboard/backend/package.json"), "0.4.3");
    assert.equal(versionOf(root, "dashboard/frontend/package.json"), "0.5.4");
    assert.equal(versionOf(root, "dashboard/package.json"), "0.2.5");
  });

  it("bumps two packages at different levels in one run", () => {
    const root = createFixtureRepo();
    runBump(root, ["mcp:major", "frontend:patch"]);

    assert.equal(versionOf(root, "mcp/package.json"), "1.0.0");
    assert.equal(versionOf(root, "dashboard/frontend/package.json"), "0.5.5");
    assert.equal(versionOf(root, "dashboard/backend/package.json"), "0.4.3");
  });

  it("syncs mcp/manifest.json alongside mcp/package.json", () => {
    const root = createFixtureRepo();
    runBump(root, ["mcp:patch"]);

    assert.equal(versionOf(root, "mcp/manifest.json"), "0.4.5");
    assert.equal(versionOf(root, "mcp/package.json"), "0.4.5");
  });

  it("derives the level from each package's own changelog", () => {
    const root = createFixtureRepo({
      changelogs: {
        mcp: changelog("\n### Added\n\n- a new tool\n"),
        "dashboard/backend": changelog("\n### Removed\n\n- dropped an endpoint\n"),
      },
    });

    runBump(root, ["mcp", "backend"]);

    assert.equal(versionOf(root, "mcp/package.json"), "0.5.0", "Added → minor");
    assert.equal(versionOf(root, "dashboard/backend/package.json"), "1.0.0", "Removed → major");
  });

  it("rewrites the changelog of every bumped package", () => {
    const root = createFixtureRepo();
    runBump(root, ["mcp:minor"]);

    const content = readFileSync(path.join(root, "mcp/CHANGELOG.md"), "utf8");
    assert.match(content, new RegExp(`## \\[0\\.5\\.0\\] - ${getTodayDate()}`));
    assert.match(content, /## \[Unreleased\]/);
    assert.equal(extractUnreleasedSection(content).trim(), "");

    // An untouched package keeps its pending entries.
    const untouched = readFileSync(path.join(root, "dashboard/backend/CHANGELOG.md"), "utf8");
    assert.match(extractUnreleasedSection(untouched), /- a fix/);
  });

  it("updates internal dependency specifiers on the dependent package", () => {
    const root = createFixtureRepo();
    runBump(root, ["backend:minor"]);

    const frontend = JSON.parse(readFileSync(path.join(root, "dashboard/frontend/package.json"), "utf8"));
    assert.equal(frontend.dependencies["@wford26/bettrack-backend"], "^0.5.0");
    assert.equal(frontend.version, "0.5.4", "the dependent itself is not bumped");
  });

  it("rolls the workspace wrapper forward with its members", () => {
    const root = createFixtureRepo({
      changelogs: {
        "dashboard/frontend": changelog("\n### Added\n\n- a page\n"),
        // Empty, so the wrapper has no signal of its own and follows its members.
        dashboard: changelog("\n"),
      },
    });

    // No explicit targets: everything is new, so every package is selected.
    runBump(root, ["--no-input"]);

    assert.equal(versionOf(root, "dashboard/frontend/package.json"), "0.6.0");
    assert.equal(versionOf(root, "dashboard/package.json"), "0.3.0", "wrapper takes the highest member level");
  });

  it("lets the wrapper's own changelog outrank its members' levels", () => {
    const root = createFixtureRepo({
      changelogs: {
        dashboard: changelog("\n### Added\n\n- a cross-cutting feature\n"),
        "dashboard/backend": changelog("\n### Fixed\n\n- a bug\n"),
        "dashboard/frontend": changelog("\n### Fixed\n\n- a bug\n"),
      },
    });

    runBump(root, ["--no-input"]);

    assert.equal(versionOf(root, "dashboard/backend/package.json"), "0.4.4");
    assert.equal(versionOf(root, "dashboard/frontend/package.json"), "0.5.5");
    assert.equal(versionOf(root, "dashboard/package.json"), "0.3.0");
  });

  it("writes nothing in dry-run mode", () => {
    const root = createFixtureRepo();
    const output = runBump(root, ["mcp:major", "--dry-run"]);

    assert.match(output, /0\.4\.4 → 1\.0\.0/);
    assert.equal(versionOf(root, "mcp/package.json"), "0.4.4");
    assert.match(readFileSync(path.join(root, "mcp/CHANGELOG.md"), "utf8"), /## \[Unreleased\]\n\n### Fixed/);
  });

  it("re-baselines only the bumped packages, so a skipped one stays changed", () => {
    const root = createFixtureRepo();

    runBump(root, ["mcp:patch"]);
    const second = runBump(root, ["--no-input", "--dry-run"]);

    // mcp was baselined by the first run; backend and frontend never were.
    assert.doesNotMatch(second, /mcp\s+0\.4\.5 → /);
    assert.match(second, /dashboard\/backend\s+0\.4\.3 → 0\.4\.4/);
    assert.match(second, /dashboard\/frontend\s+0\.5\.4 → 0\.5\.5/);
  });

  it("reports no changes once every package has been baselined", () => {
    const root = createFixtureRepo();

    runBump(root, ["--no-input"]);
    const second = runBump(root, ["--no-input"]);

    assert.match(second, /No changes detected/);
  });

  it("detects a source edit after a clean baseline", () => {
    const root = createFixtureRepo();
    runBump(root, ["--no-input"]);

    writeFileSync(path.join(root, "dashboard/backend/src/index.ts"), "export const backend = 2;\n", "utf8");
    const output = runBump(root, ["--no-input", "--dry-run"]);

    assert.match(output, /dashboard\/backend\s+0\.4\.4 → 0\.4\.5/);
    assert.doesNotMatch(output, /mcp\s+\S+ → /);
  });

  it("bumps a package on request even when nothing changed", () => {
    const root = createFixtureRepo();
    runBump(root, ["--no-input"]);

    runBump(root, ["mcp:minor"]);
    assert.equal(versionOf(root, "mcp/package.json"), "0.5.0");
  });

  it("exits non-zero with a readable message on a bad package name", () => {
    const root = createFixtureRepo();

    assert.throws(
      () => runBump(root, ["nosuchpackage"]),
      (error) => {
        assert.equal(error.status, 1);
        assert.match(error.stderr, /Unknown package "nosuchpackage"/);
        return true;
      }
    );
  });
});

describe("bump CLI tag mode (end to end)", () => {
  it("creates one annotated tag per package at the current version", () => {
    const root = createFixtureRepo();
    runBump(root, ["mcp:minor", "backend:patch"]);
    commitAll(root, "chore: bump");

    runBump(root, ["--tag", "mcp", "backend"]);

    const tags = execFileSync("git", ["tag"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
    assert.deepEqual(tags.sort(), ["backend-v0.4.4", "mcp-v0.5.0"]);

    const annotation = execFileSync("git", ["tag", "-n", "mcp-v0.5.0"], { cwd: root, encoding: "utf8" });
    assert.match(annotation, /mcp v0\.5\.0/);
  });

  it("refuses to tag a dirty working tree", () => {
    const root = createFixtureRepo();
    runBump(root, ["mcp:minor"]); // leaves the bump uncommitted

    assert.throws(
      () => runBump(root, ["--tag", "mcp"]),
      (error) => {
        assert.equal(error.status, 1);
        assert.match(error.stderr, /dirty/i);
        return true;
      }
    );

    assert.equal(execFileSync("git", ["tag"], { cwd: root, encoding: "utf8" }).trim(), "");
  });

  it("skips tags that already exist instead of failing", () => {
    const root = createFixtureRepo();
    runBump(root, ["mcp:minor"]);
    commitAll(root, "chore: bump");

    runBump(root, ["--tag", "mcp"]);
    const output = runBump(root, ["--tag", "mcp"]);

    assert.match(output, /already exists/);
  });

  it("previews in dry-run mode despite a dirty tree, without creating tags", () => {
    const root = createFixtureRepo();
    runBump(root, ["mcp:minor"]); // leaves the bump uncommitted

    const output = runBump(root, ["--tag", "mcp", "--dry-run"]);

    assert.match(output, /dirty/i, "still warns about the dirty tree");
    assert.match(output, /would create mcp-v0\.5\.0/, "but does not withhold the preview");
    assert.equal(execFileSync("git", ["tag"], { cwd: root, encoding: "utf8" }).trim(), "");
  });

  it("creates no tags in dry-run mode", () => {
    const root = createFixtureRepo();
    runBump(root, ["mcp:minor"]);
    commitAll(root, "chore: bump");

    const output = runBump(root, ["--tag", "mcp", "--dry-run"]);

    assert.match(output, /would create mcp-v0\.5\.0/);
    assert.equal(execFileSync("git", ["tag"], { cwd: root, encoding: "utf8" }).trim(), "");
  });
});
