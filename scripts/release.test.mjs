/**
 * Tests for the release script.
 *
 * Run with: npm run test:release  (from dashboard/), or `node --test scripts/*.test.mjs`.
 * Same approach as bump-version.test.mjs — unit tests over the exported pure
 * functions, plus end-to-end tests that build a throwaway repo, copy both real
 * scripts into it, and drive the actual CLI as a subprocess.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  ReleaseError,
  componentTag,
  demoteHeadings,
  evaluatePreflight,
  nextDatedTag,
  parseArgs,
  renderReleaseNotes,
  renderRootChangelog,
  resolveScope,
  scopeFromTag,
} from "./release.mjs";

const SCRIPTS_DIR = fileURLToPath(new URL(".", import.meta.url));

// ---------------------------------------------------------------------------
// Scope and argument parsing
// ---------------------------------------------------------------------------

describe("resolveScope", () => {
  it("resolves every documented alias", () => {
    assert.equal(resolveScope("all"), "all");
    assert.equal(resolveScope("full"), "all");
    assert.equal(resolveScope("repo"), "all");
    assert.equal(resolveScope("mcp"), "mcp");
    assert.equal(resolveScope("server"), "mcp");
    assert.equal(resolveScope("dashboard"), "dashboard");
    assert.equal(resolveScope("web"), "dashboard");
    assert.equal(resolveScope("backend"), "backend");
    assert.equal(resolveScope("be"), "backend");
    assert.equal(resolveScope("api"), "backend");
    assert.equal(resolveScope("frontend"), "frontend");
    assert.equal(resolveScope("fe"), "frontend");
    assert.equal(resolveScope("ui"), "frontend");
  });

  it("is case and whitespace insensitive", () => {
    assert.equal(resolveScope("  MCP  "), "mcp");
    assert.equal(resolveScope("Backend"), "backend");
  });

  it("rejects anything else", () => {
    assert.throws(() => resolveScope("nope"), ReleaseError);
    assert.throws(() => resolveScope(""), ReleaseError);
  });
});

describe("parseArgs", () => {
  it("defaults to a full release with no flags", () => {
    const args = parseArgs([]);
    assert.equal(args.scope, "all");
    assert.equal(args.dryRun, false);
    assert.equal(args.push, false);
    assert.equal(args.ci, false);
    assert.equal(args.branch, "main");
  });

  it("takes a scope positionally", () => {
    assert.equal(parseArgs(["mcp"]).scope, "mcp");
    assert.equal(parseArgs(["be"]).scope, "backend");
  });

  it("rejects two scopes", () => {
    assert.throws(() => parseArgs(["mcp", "backend"]), ReleaseError);
  });

  it("parses flags with both spellings", () => {
    assert.equal(parseArgs(["--bump", "minor"]).bump, "minor");
    assert.equal(parseArgs(["--bump=minor"]).bump, "minor");
    assert.equal(parseArgs(["--branch", "beta"]).branch, "beta");
    assert.equal(parseArgs(["--branch=beta"]).branch, "beta");
  });

  it("makes --ci imply push", () => {
    const args = parseArgs(["--ci"]);
    assert.equal(args.ci, true);
    assert.equal(args.push, true);
  });

  it("makes --json imply dry-run, so a plan query never writes", () => {
    const args = parseArgs(["--json"]);
    assert.equal(args.json, true);
    assert.equal(args.dryRun, true);
  });

  it("parses the escape hatches", () => {
    const args = parseArgs(["--allow-dirty", "--allow-empty-notes", "--skip-preflight"]);
    assert.equal(args.allowDirty, true);
    assert.equal(args.allowEmptyNotes, true);
    assert.equal(args.skipPreflight, true);
  });

  it("derives the scope from --from-tag and forces a read-only run", () => {
    const args = parseArgs(["--from-tag", "mcp-v1.1.0"]);
    assert.equal(args.scope, "mcp");
    assert.equal(args.fromTag, "mcp-v1.1.0");
    assert.equal(args.dryRun, true, "querying an existing tag must never write");
  });

  it("rejects --from-tag that contradicts an explicit scope", () => {
    assert.throws(() => parseArgs(["backend", "--from-tag", "mcp-v1.1.0"]), ReleaseError);
    assert.doesNotThrow(() => parseArgs(["mcp", "--from-tag", "mcp-v1.1.0"]));
  });

  it("rejects a --from-tag that names no scope", () => {
    assert.throws(() => parseArgs(["--from-tag", "v1.2.3"]), ReleaseError);
  });

  it("rejects bad levels and unknown flags", () => {
    assert.throws(() => parseArgs(["--bump", "huge"]), ReleaseError);
    assert.throws(() => parseArgs(["--bump"]), ReleaseError);
    assert.throws(() => parseArgs(["--branch"]), ReleaseError);
    assert.throws(() => parseArgs(["--nonsense"]), ReleaseError);
  });
});

// ---------------------------------------------------------------------------
// Tag resolution
// ---------------------------------------------------------------------------

describe("nextDatedTag", () => {
  it("uses the bare date when it is free", () => {
    assert.equal(nextDatedTag("2026.08.18", () => false), "2026.08.18");
  });

  it("appends a dotted counter when the date is taken", () => {
    const taken = new Set(["2026.08.18"]);
    assert.equal(nextDatedTag("2026.08.18", (tag) => taken.has(tag)), "2026.08.18.1");
  });

  it("keeps counting past existing suffixes", () => {
    const taken = new Set(["2026.08.18", "2026.08.18.1", "2026.08.18.2"]);
    assert.equal(nextDatedTag("2026.08.18", (tag) => taken.has(tag)), "2026.08.18.3");
  });

  it("produces tags that match release.yml's trigger patterns", () => {
    // release.yml triggers on '[0-9]+.[0-9]+.[0-9]+' and '[0-9]+.[0-9]+.[0-9]+.[0-9]+'
    const plain = nextDatedTag("2026.08.18", () => false);
    const suffixed = nextDatedTag("2026.08.18", (tag) => tag === "2026.08.18");

    assert.match(plain, /^\d+\.\d+\.\d+$/);
    assert.match(suffixed, /^\d+\.\d+\.\d+\.\d+$/);
  });

  it("gives up rather than looping forever", () => {
    assert.throws(() => nextDatedTag("2026.08.18", () => true), ReleaseError);
  });
});

describe("scopeFromTag", () => {
  it("reads a dated tag as a full release", () => {
    assert.equal(scopeFromTag("2026.08.18"), "all");
    assert.equal(scopeFromTag("2026.08.18.1"), "all");
  });

  it("reads a component tag back to its scope", () => {
    assert.equal(scopeFromTag("mcp-v1.1.0"), "mcp");
    assert.equal(scopeFromTag("backend-v0.5.1"), "backend");
    assert.equal(scopeFromTag("frontend-v0.6.1"), "frontend");
    assert.equal(scopeFromTag("dashboard-v0.4.0"), "dashboard");
  });

  it("round-trips every component tag this script creates", () => {
    for (const scope of ["mcp", "backend", "frontend", "dashboard"]) {
      assert.equal(scopeFromTag(componentTag(scope, "1.2.3")), scope);
    }
  });

  it("returns null for tags this project did not create", () => {
    assert.equal(scopeFromTag("v1.2.3"), null);
    assert.equal(scopeFromTag("nightly-v1.2.3"), null);
    assert.equal(scopeFromTag("random-tag"), null);
    assert.equal(scopeFromTag(""), null);
  });
});

describe("componentTag", () => {
  it("names the tag after the scope", () => {
    assert.equal(componentTag("mcp", "1.1.0"), "mcp-v1.1.0");
    assert.equal(componentTag("backend", "0.5.1"), "backend-v0.5.1");
    assert.equal(componentTag("frontend", "0.6.1"), "frontend-v0.6.1");
    assert.equal(componentTag("dashboard", "0.4.0"), "dashboard-v0.4.0");
  });

  it("does not collide with the dated tag pattern", () => {
    assert.doesNotMatch(componentTag("mcp", "1.1.0"), /^\d+\.\d+\.\d+(\.\d+)?$/);
  });
});

// ---------------------------------------------------------------------------
// Release notes
// ---------------------------------------------------------------------------

describe("demoteHeadings", () => {
  it("pushes package headings one level down", () => {
    assert.equal(demoteHeadings("### Added\n\n- a thing"), "#### Added\n\n- a thing");
    assert.equal(demoteHeadings("#### Detail"), "##### Detail");
  });

  it("leaves body text and list items alone", () => {
    const body = "- a bullet with a # in it\n\n  nested text";
    assert.equal(demoteHeadings(body), body);
  });

  it("does not demote a top-level h1", () => {
    assert.equal(demoteHeadings("# Title"), "# Title");
  });
});

describe("renderReleaseNotes", () => {
  const entries = [
    { key: "mcp", nextVersion: "1.1.0", notes: "### Added\n\n- A new tool" },
    { key: "dashboard/backend", nextVersion: "0.5.1", notes: "### Fixed\n\n- CLV defect" },
    { key: "dashboard/frontend", nextVersion: "0.6.1", notes: "" },
  ];

  it("leads with a package version summary", () => {
    const notes = renderReleaseNotes({ tag: "2026.08.18", entries, projectNotes: "" });

    assert.match(notes, /^## \[2026\.08\.18\]/);
    assert.match(notes, /- \*\*MCP:\*\* v1\.1\.0/);
    assert.match(notes, /- \*\*Backend:\*\* v0\.5\.1/);
    assert.match(notes, /- \*\*Frontend:\*\* v0\.6\.1/);
  });

  it("gives each contributing package its own section, using friendly names", () => {
    const notes = renderReleaseNotes({ tag: "2026.08.18", entries, projectNotes: "" });

    assert.match(notes, /### MCP Server\n\n#### Added\n\n- A new tool/);
    assert.match(notes, /### Backend\n\n#### Fixed\n\n- CLV defect/);
  });

  it("omits packages with no entries, while still listing their version", () => {
    const notes = renderReleaseNotes({ tag: "2026.08.18", entries, projectNotes: "" });

    assert.match(notes, /- \*\*Frontend:\*\* v0\.6\.1/, "version is still reported");
    assert.doesNotMatch(notes, /### Frontend\n/, "but it gets no empty section");
  });

  it("places project notes above the per-package sections", () => {
    const notes = renderReleaseNotes({
      tag: "2026.08.18",
      entries,
      projectNotes: "- A repo-wide change",
    });

    assert.match(notes, /### Project\n\n- A repo-wide change/);
    assert.equal(notes.indexOf("### Project") < notes.indexOf("### MCP Server"), true);
  });

  it("renders a bare header when there is nothing to say", () => {
    const notes = renderReleaseNotes({ tag: "mcp-v1.1.0", entries: [], projectNotes: "" });
    assert.equal(notes.trim(), "## [mcp-v1.1.0]");
  });
});

describe("renderRootChangelog", () => {
  const changelog = `# Changelog

## [Unreleased]

- A pending project note

---

## [2026.05.14]

- An old release
`;

  it("inserts the block and clears [Unreleased] for a full release", () => {
    const { content, changed } = renderRootChangelog(changelog, "## [2026.08.18]\n\n- New stuff");

    assert.equal(changed, true);
    assert.match(content, /## \[2026\.08\.18\]/);
    assert.doesNotMatch(content, /- A pending project note/, "consumed into the release");
    assert.match(content, /## \[2026\.05\.14\]/, "history is preserved");
  });

  it("keeps [Unreleased] intact for a component release", () => {
    const { content } = renderRootChangelog(changelog, "## [mcp-v1.1.0]\n\n- MCP only", {
      clearUnreleased: false,
    });

    assert.match(content, /- A pending project note/, "project notes survive");
    assert.match(content, /## \[mcp-v1\.1\.0\]/);
    assert.equal(
      content.indexOf("- A pending project note") < content.indexOf("## [mcp-v1.1.0]"),
      true,
      "pending notes stay above the new block"
    );
  });

  it("puts the newest release directly below [Unreleased]", () => {
    const { content } = renderRootChangelog(changelog, "## [2026.08.18]\n\n- New stuff");
    assert.equal(content.indexOf("## [2026.08.18]") < content.indexOf("## [2026.05.14]"), true);
  });

  it("is a no-op when there is no [Unreleased] section", () => {
    const original = "# Changelog\n\n## [2026.05.14]\n\n- old\n";
    const { content, changed } = renderRootChangelog(original, "## [x]");

    assert.equal(changed, false);
    assert.equal(content, original);
  });
});

// ---------------------------------------------------------------------------
// Preflight
// ---------------------------------------------------------------------------

describe("evaluatePreflight", () => {
  const clean = {
    branch: "main",
    currentBranch: "main",
    dirty: false,
    behind: 0,
    tagState: null,
    hasNotes: true,
  };
  const permissive = { allowDirty: false, allowEmptyNotes: false };

  const check = (overrides, options = {}) =>
    evaluatePreflight({ ...clean, ...overrides }, { ...permissive, ...options });

  it("passes on a clean, current, on-branch repo", () => {
    const { problems, warnings } = check({});
    assert.deepEqual(problems, []);
    assert.deepEqual(warnings, []);
  });

  it("blocks a release from the wrong branch", () => {
    const { problems } = check({ currentBranch: "beta" });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /must come from "main"/);
  });

  it("accepts the branch the caller asked for", () => {
    const { problems } = check({ branch: "beta", currentBranch: "beta" });
    assert.deepEqual(problems, []);
  });

  it("blocks a dirty tree unless allowed", () => {
    assert.equal(check({ dirty: true }).problems.length, 1);
    assert.deepEqual(check({ dirty: true }, { allowDirty: true }).problems, []);
  });

  it("blocks when behind origin", () => {
    const { problems } = check({ behind: 3 });
    assert.match(problems[0], /3 commit\(s\) behind/);
  });

  it("warns rather than blocks when origin is unreachable", () => {
    const { problems, warnings } = check({ behind: null });
    assert.deepEqual(problems, []);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /Could not reach origin/);
  });

  it("blocks when the tag already exists locally or remotely", () => {
    assert.match(check({ tagState: "local" }).problems[0], /already exists \(local\)/);
    assert.match(check({ tagState: "remote" }).problems[0], /already exists \(remote\)/);
  });

  it("warns when the remote tag state is unknown", () => {
    const { problems, warnings } = check({ tagState: "unknown" });
    assert.deepEqual(problems, []);
    assert.match(warnings[0], /could not confirm the tag is free/);
  });

  it("blocks an empty release unless allowed", () => {
    assert.match(check({ hasNotes: false }).problems[0], /nothing to release/);
    assert.deepEqual(check({ hasNotes: false }, { allowEmptyNotes: true }).problems, []);
  });

  it("reports every problem at once rather than stopping at the first", () => {
    const { problems } = check({ currentBranch: "beta", dirty: true, behind: 2, hasNotes: false });
    assert.equal(problems.length, 4);
  });
});

// ---------------------------------------------------------------------------
// End-to-end
// ---------------------------------------------------------------------------

const fixtures = [];

after(() => {
  for (const dir of fixtures) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const CHANGELOG_HEADER = `# Changelog

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
`;

function changelog(body) {
  return `${CHANGELOG_HEADER}
## [Unreleased]
${body}
---

## [0.1.0] - 2026-01-01

### Added

- Initial release
`;
}

/**
 * A BetTrack-shaped repo with both scripts installed and an `origin` remote, so
 * preflight's fetch and ls-remote paths run for real rather than being stubbed.
 */
function createFixtureRepo({ changelogs = {}, rootChangelog } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "bettrack-release-"));
  fixtures.push(root);

  const write = (relPath, content) => {
    const abs = path.join(root, relPath);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content, "utf8");
  };

  const manifests = {
    "mcp/package.json": { name: "sports-data-mcp", version: "1.0.0" },
    "mcp/manifest.json": { name: "sports-data-mcp", version: "1.0.0" },
    "dashboard/package.json": { name: "sports-betting-dashboard", version: "0.3.0" },
    "dashboard/backend/package.json": { name: "@wford26/bettrack-backend", version: "0.5.0" },
    "dashboard/frontend/package.json": { name: "@wford26/bettrack-frontend", version: "0.6.0" },
  };

  for (const [relPath, manifest] of Object.entries(manifests)) {
    write(relPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }

  for (const dir of ["mcp", "dashboard", "dashboard/backend", "dashboard/frontend"]) {
    write(`${dir}/CHANGELOG.md`, changelogs[dir] ?? changelog("\n### Fixed\n\n- a fix\n"));
  }

  write("CHANGELOG.md", rootChangelog ?? changelog("\n- A project-wide note\n"));
  write("mcp/server.py", "print('mcp')\n");
  write("dashboard/backend/src/index.ts", "export const backend = 1;\n");
  write("dashboard/frontend/src/main.tsx", "export const frontend = 1;\n");

  mkdirSync(path.join(root, "scripts"), { recursive: true });
  for (const file of ["bump-version.mjs", "release.mjs"]) {
    cpSync(path.join(SCRIPTS_DIR, file), path.join(root, "scripts", file));
  }

  const git = (...args) => execFileSync("git", args, { cwd: root, stdio: "ignore" });
  git("init", "-q", "-b", "main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  git("add", "-A");
  git("commit", "-qm", "initial");

  // A local bare repo stands in for origin so fetch and ls-remote work offline.
  const remote = `${root}-origin.git`;
  fixtures.push(remote);
  execFileSync("git", ["init", "-q", "--bare", remote], { stdio: "ignore" });
  git("remote", "add", "origin", remote);
  git("push", "-q", "-u", "origin", "main");

  return root;
}

function runRelease(root, args = [], options = {}) {
  return execFileSync("node", [path.join(root, "scripts", "release.mjs"), ...args], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

function versionOf(root, relPath) {
  return JSON.parse(readFileSync(path.join(root, relPath), "utf8")).version;
}

function tagsOf(root) {
  return execFileSync("git", ["tag"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
}

describe("release CLI (end to end)", () => {
  it("plans a full release with a dated tag covering every package", () => {
    const root = createFixtureRepo();
    const plan = JSON.parse(runRelease(root, ["--json"]));

    assert.equal(plan.scope, "all");
    assert.match(plan.tag, /^\d{4}\.\d{2}\.\d{2}$/);
    assert.deepEqual(
      plan.packages.map((pkg) => pkg.key),
      ["mcp", "dashboard/backend", "dashboard/frontend", "dashboard"]
    );
  });

  it("plans a component release with its own tag and narrower artifacts", () => {
    const root = createFixtureRepo();
    const plan = JSON.parse(runRelease(root, ["mcp", "--json"]));

    assert.equal(plan.tag, "mcp-v1.0.1");
    assert.deepEqual(plan.packages.map((pkg) => pkg.key), ["mcp"]);
    assert.deepEqual(plan.artifacts, ["mcpb"]);
  });

  it("takes each package's level from its own changelog", () => {
    const root = createFixtureRepo({
      changelogs: {
        mcp: changelog("\n### Added\n\n- a tool\n"),
        "dashboard/backend": changelog("\n### Removed\n\n- an endpoint\n"),
      },
    });

    const plan = JSON.parse(runRelease(root, ["--json"]));
    const level = (key) => plan.packages.find((pkg) => pkg.key === key).level;

    assert.equal(level("mcp"), "minor");
    assert.equal(level("dashboard/backend"), "major");
    assert.equal(level("dashboard/frontend"), "patch");
  });

  it("honors --bump over the changelog's verdict", () => {
    const root = createFixtureRepo({ changelogs: { mcp: changelog("\n### Fixed\n\n- a fix\n") } });
    const plan = JSON.parse(runRelease(root, ["mcp", "--bump", "major", "--json"]));

    assert.equal(plan.packages[0].level, "major");
    assert.equal(plan.tag, "mcp-v2.0.0");
  });

  it("writes nothing in dry-run mode", () => {
    const root = createFixtureRepo();
    const output = runRelease(root, ["--dry-run"]);

    assert.match(output, /Dry run — nothing written/);
    assert.equal(versionOf(root, "mcp/package.json"), "1.0.0");
    assert.deepEqual(tagsOf(root), []);
    assert.match(readFileSync(path.join(root, "CHANGELOG.md"), "utf8"), /- A project-wide note/);
  });

  it("bumps, rewrites the root changelog, commits, and tags", () => {
    const root = createFixtureRepo({
      changelogs: { mcp: changelog("\n### Added\n\n- a new tool\n") },
    });

    runRelease(root, ["--skip-preflight"]);

    assert.equal(versionOf(root, "mcp/package.json"), "1.1.0");
    assert.equal(versionOf(root, "dashboard/backend/package.json"), "0.5.1");

    const tags = tagsOf(root);
    assert.equal(tags.length, 1);
    assert.match(tags[0], /^\d{4}\.\d{2}\.\d{2}$/);

    const rootLog = readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
    assert.match(rootLog, new RegExp(`## \\[${tags[0]}\\]`));
    assert.match(rootLog, /### MCP Server\n\n#### Added\n\n- a new tool/);
    assert.match(rootLog, /- \*\*MCP:\*\* v1\.1\.0/);
    assert.match(rootLog, /### Project\n\n- A project-wide note/, "project notes rolled in");

    const message = execFileSync("git", ["log", "-1", "--pretty=%B"], { cwd: root, encoding: "utf8" });
    assert.match(message, /chore\(release\)/);
    assert.match(message, /mcp: v1\.1\.0/);
  });

  it("does not push unless asked", () => {
    const root = createFixtureRepo();
    const output = runRelease(root, ["--skip-preflight"]);

    assert.match(output, /Push when ready/);
    const remoteTags = execFileSync("git", ["ls-remote", "--tags", "origin"], { cwd: root, encoding: "utf8" });
    assert.equal(remoteTags.trim(), "", "nothing reached origin");
  });

  it("pushes the commit and tag with --push", () => {
    const root = createFixtureRepo();
    runRelease(root, ["--skip-preflight", "--push"]);

    const remoteTags = execFileSync("git", ["ls-remote", "--tags", "origin"], { cwd: root, encoding: "utf8" });
    assert.match(remoteTags, /refs\/tags\/\d{4}\.\d{2}\.\d{2}/);
  });

  it("leaves the project notes alone for a component release", () => {
    const root = createFixtureRepo();
    runRelease(root, ["mcp", "--skip-preflight"]);

    const rootLog = readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
    assert.match(rootLog, /## \[mcp-v1\.0\.1\]/, "the component release is recorded");
    assert.match(rootLog, /- A project-wide note/, "but the project notes are not consumed");
    assert.doesNotMatch(rootLog, /### Project/, "and are not folded into this release");

    assert.equal(versionOf(root, "dashboard/backend/package.json"), "0.5.0", "other packages untouched");
  });

  it("avoids a tag collision by appending a counter", () => {
    const root = createFixtureRepo();
    runRelease(root, ["--skip-preflight"]);
    const first = tagsOf(root)[0];

    runRelease(root, ["--skip-preflight", "--allow-empty-notes"]);
    const tags = tagsOf(root).sort();

    assert.deepEqual(tags, [first, `${first}.1`]);
  });

  it("emits GitHub outputs in CI mode", () => {
    const root = createFixtureRepo();
    const outputPath = path.join(root, "gh-output.txt");
    writeFileSync(outputPath, "", "utf8");

    runRelease(root, ["mcp", "--skip-preflight"], {
      env: { ...process.env, GITHUB_OUTPUT: outputPath },
    });

    const output = readFileSync(outputPath, "utf8");
    assert.match(output, /release_tag=mcp-v1\.0\.1/);
    assert.match(output, /scope=mcp/);
    assert.match(output, /artifacts=mcpb/);
    assert.match(output, /version_mcp=1\.0\.1/);
    assert.match(output, /build_mcpb=true/);
    assert.match(output, /release_notes<<RELEASE_NOTES_EOF/);
  });

  it("blocks on a dirty tree and writes nothing", () => {
    const root = createFixtureRepo();
    writeFileSync(path.join(root, "mcp/server.py"), "print('changed')\n", "utf8");

    assert.throws(
      () => runRelease(root, []),
      (error) => {
        assert.equal(error.status, 1);
        assert.match(error.stdout + error.stderr, /Working tree is dirty/);
        return true;
      }
    );

    assert.equal(versionOf(root, "mcp/package.json"), "1.0.0");
    assert.deepEqual(tagsOf(root), []);
  });

  it("blocks a release from the wrong branch", () => {
    const root = createFixtureRepo();
    execFileSync("git", ["checkout", "-qb", "feature/x"], { cwd: root });

    assert.throws(
      () => runRelease(root, []),
      (error) => {
        assert.match(error.stdout + error.stderr, /must come from "main"/);
        return true;
      }
    );
  });

  it("blocks a release with no changelog entries anywhere", () => {
    const root = createFixtureRepo({
      changelogs: {
        mcp: changelog("\n"),
        dashboard: changelog("\n"),
        "dashboard/backend": changelog("\n"),
        "dashboard/frontend": changelog("\n"),
      },
      rootChangelog: changelog("\n"),
    });

    assert.throws(
      () => runRelease(root, []),
      (error) => {
        assert.match(error.stdout + error.stderr, /nothing to release/);
        return true;
      }
    );
  });

  it("exits non-zero with a readable message on a bad scope", () => {
    const root = createFixtureRepo();

    assert.throws(
      () => runRelease(root, ["nosuchscope"]),
      (error) => {
        assert.equal(error.status, 1);
        assert.match(error.stderr, /Unknown release scope "nosuchscope"/);
        return true;
      }
    );
  });
});
