/**
 * Tests for the Docker build script.
 *
 * Run with: npm run test:docker  (from dashboard/), or
 * `node --test scripts/*.test.mjs`.
 *
 * There are no end-to-end tests here: actually building an image needs a Docker
 * daemon and minutes per run. Instead the command assembly is a pure function,
 * so the exact `docker buildx build` invocation is asserted directly — which is
 * where the bugs in the old shell scripts lived.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DockerBuildError,
  buildxArgs,
  cacheEntriesFor,
  detectOwner,
  evaluateLatestPolicy,
  imageRef,
  ociLabels,
  parseArgs,
  resolveTarget,
  shellQuote,
  versionsFrom,
} from "./docker-build.mjs";

// ---------------------------------------------------------------------------
// Targets
// ---------------------------------------------------------------------------

describe("resolveTarget", () => {
  it("resolves each image and its aliases", () => {
    assert.deepEqual(resolveTarget("backend"), ["backend"]);
    assert.deepEqual(resolveTarget("be"), ["backend"]);
    assert.deepEqual(resolveTarget("api"), ["backend"]);
    assert.deepEqual(resolveTarget("frontend"), ["frontend"]);
    assert.deepEqual(resolveTarget("fe"), ["frontend"]);
    assert.deepEqual(resolveTarget("ui"), ["frontend"]);
  });

  it("expands release scopes to both images", () => {
    assert.deepEqual(resolveTarget("all"), ["backend", "frontend"]);
    assert.deepEqual(resolveTarget("dashboard"), ["backend", "frontend"]);
    assert.deepEqual(resolveTarget("web"), ["backend", "frontend"]);
  });

  it("is case and whitespace insensitive", () => {
    assert.deepEqual(resolveTarget("  BACKEND "), ["backend"]);
  });

  it("explains why mcp has no image rather than saying 'unknown'", () => {
    assert.throws(
      () => resolveTarget("mcp"),
      (error) => {
        assert.ok(error instanceof DockerBuildError);
        assert.match(error.message, /MCPB package, not a Docker image/);
        return true;
      }
    );
  });

  it("rejects anything else", () => {
    assert.throws(() => resolveTarget("nope"), DockerBuildError);
  });
});

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

describe("parseArgs", () => {
  it("takes targets positionally", () => {
    assert.deepEqual(parseArgs(["backend"]).targets, ["backend"]);
    assert.deepEqual(parseArgs(["all"]).targets, ["backend", "frontend"]);
  });

  it("still accepts the old shell script flags", () => {
    assert.deepEqual(parseArgs(["--backend"]).targets, ["backend"]);
    assert.deepEqual(parseArgs(["--backend", "--frontend"]).targets, ["backend", "frontend"]);
    assert.deepEqual(parseArgs(["--all"]).targets, ["backend", "frontend"]);
  });

  it("de-duplicates targets and keeps a stable order", () => {
    assert.deepEqual(parseArgs(["frontend", "backend", "backend"]).targets, ["backend", "frontend"]);
    assert.deepEqual(parseArgs(["all", "backend"]).targets, ["backend", "frontend"]);
  });

  it("requires a target", () => {
    assert.throws(() => parseArgs([]), DockerBuildError);
    assert.throws(() => parseArgs(["--push"]), DockerBuildError);
  });

  it("does not require a target for --help", () => {
    assert.equal(parseArgs(["--help"]).help, true);
  });

  it("defaults the registry, repository, and safety switches", () => {
    const args = parseArgs(["backend"]);
    assert.equal(args.registry, "ghcr.io");
    assert.equal(args.repository, "bettrack");
    assert.equal(args.push, false);
    assert.equal(args.latest, false, "latest is never on by default");
    assert.equal(args.dryRun, false);
  });

  it("parses valued flags in both spellings", () => {
    assert.equal(parseArgs(["backend", "--version", "1.2.3"]).version, "1.2.3");
    assert.equal(parseArgs(["backend", "--version=1.2.3"]).version, "1.2.3");
    assert.equal(parseArgs(["backend", "--owner", "someone"]).owner, "someone");
    assert.equal(parseArgs(["backend", "--platform=linux/arm64"]).platform, "linux/arm64");
    assert.equal(parseArgs(["backend", "--from-tag", "2026.08.18"]).fromTag, "2026.08.18");
    assert.equal(parseArgs(["backend", "--repository", "other"]).repository, "other");
  });

  it("rejects two conflicting version sources", () => {
    assert.throws(() => parseArgs(["backend", "--version", "1.0.0", "--from-tag", "2026.08.18"]), DockerBuildError);
  });

  it("rejects missing values and unknown flags", () => {
    assert.throws(() => parseArgs(["backend", "--version"]), DockerBuildError);
    assert.throws(() => parseArgs(["backend", "--nonsense"]), DockerBuildError);
  });
});

// ---------------------------------------------------------------------------
// Registry naming
// ---------------------------------------------------------------------------

describe("detectOwner", () => {
  it("reads the owner from both remote URL forms", () => {
    assert.equal(detectOwner("git@github.com:WFord26/BetTrack.git"), "WFord26");
    assert.equal(detectOwner("https://github.com/WFord26/BetTrack.git"), "WFord26");
    assert.equal(detectOwner("https://github.com/WFord26/BetTrack"), "WFord26");
  });

  it("returns null for anything it cannot parse", () => {
    assert.equal(detectOwner("https://gitlab.com/someone/thing.git"), null);
    assert.equal(detectOwner(""), null);
    assert.equal(detectOwner(null), null);
  });
});

describe("imageRef", () => {
  it("builds the registry path used by the workflows", () => {
    assert.equal(
      imageRef({ registry: "ghcr.io", owner: "WFord26", repository: "bettrack", image: "backend" }),
      "ghcr.io/wford26/bettrack/backend"
    );
  });

  it("lowercases the whole ref, since GHCR rejects uppercase paths", () => {
    const ref = imageRef({ registry: "GHCR.IO", owner: "WFord26", repository: "BetTrack", image: "Backend" });
    assert.equal(ref, ref.toLowerCase());
    assert.equal(ref, "ghcr.io/wford26/bettrack/backend");
  });
});

// ---------------------------------------------------------------------------
// The latest guard
// ---------------------------------------------------------------------------

describe("evaluateLatestPolicy", () => {
  const base = {
    latest: true,
    push: true,
    branch: "main",
    currentBranch: "main",
    dirty: false,
    allowDirty: false,
  };

  const check = (overrides) => evaluateLatestPolicy({ ...base, ...overrides });

  it("allows latest from a clean main with --push", () => {
    assert.deepEqual(check({}), []);
  });

  it("says nothing at all when --latest was not asked for", () => {
    assert.deepEqual(check({ latest: false, currentBranch: "feature/x", dirty: true }), []);
  });

  it("refuses latest from a feature branch", () => {
    const problems = check({ currentBranch: "feature/x" });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /only be moved from "main"/);
  });

  it("refuses latest from a dirty tree", () => {
    assert.match(check({ dirty: true })[0], /clean tree/);
  });

  it("lets --allow-dirty past the tree check but not the branch check", () => {
    assert.deepEqual(check({ dirty: true, allowDirty: true }), []);
    assert.equal(check({ dirty: true, allowDirty: true, currentBranch: "beta" }).length, 1);
  });

  it("points out that --latest without --push does nothing", () => {
    assert.match(check({ push: false })[0], /only means something with --push/);
  });

  it("reports every reason at once", () => {
    assert.equal(check({ push: false, currentBranch: "beta", dirty: true }).length, 3);
  });
});

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------

describe("versionsFrom", () => {
  const plan = {
    packages: [
      { key: "dashboard/backend", currentVersion: "0.5.0", nextVersion: "0.5.1" },
      { key: "dashboard/frontend", currentVersion: "0.6.0", nextVersion: "0.6.1" },
    ],
  };

  it("uses what is checked out now, not the next bump", () => {
    assert.deepEqual(versionsFrom(plan, ["backend", "frontend"], null), {
      backend: "0.5.0",
      frontend: "0.6.0",
    });
  });

  it("falls back to nextVersion when a plan reports only that", () => {
    const tagPlan = { packages: [{ key: "dashboard/backend", nextVersion: "0.5.1" }] };
    assert.deepEqual(versionsFrom(tagPlan, ["backend"], null), { backend: "0.5.1" });
  });

  it("lets an explicit override win for every target", () => {
    assert.deepEqual(versionsFrom(plan, ["backend", "frontend"], "9.9.9"), {
      backend: "9.9.9",
      frontend: "9.9.9",
    });
  });

  it("fails loudly rather than tagging an image with undefined", () => {
    assert.throws(() => versionsFrom({ packages: [] }, ["backend"], null), DockerBuildError);
  });
});

// ---------------------------------------------------------------------------
// Buildx command assembly
// ---------------------------------------------------------------------------

describe("buildxArgs", () => {
  const base = {
    context: "/repo/dashboard",
    dockerfile: "/repo/dashboard/backend/Dockerfile",
    tags: ["ghcr.io/o/bettrack/backend:0.5.0"],
    labels: { "org.opencontainers.image.version": "0.5.0" },
    platforms: "linux/amd64,linux/arm64",
    push: true,
  };

  const build = (overrides) => buildxArgs({ ...base, ...overrides });

  it("uses buildx, never plain docker build", () => {
    const args = build({});
    assert.equal(args[0], "buildx");
    assert.equal(args[1], "build");
  });

  it("pushes in the same invocation as the build, so multi-arch works", () => {
    // The old scripts built, then `docker tag`, then `docker push` — which
    // cannot produce a manifest list. --push must be part of the build.
    const args = build({});
    assert.ok(args.includes("--push"));
    assert.ok(!args.includes("--load"));
    assert.equal(args[args.indexOf("--platform") + 1], "linux/amd64,linux/arm64");
  });

  it("loads instead of pushing for a local build", () => {
    const args = build({ push: false, platforms: "linux/arm64" });
    assert.ok(args.includes("--load"));
    assert.ok(!args.includes("--push"));
  });

  it("puts the context last, where docker expects it", () => {
    assert.equal(build({}).at(-1), "/repo/dashboard");
  });

  it("passes every tag through", () => {
    const args = build({ tags: ["a:1", "a:latest"] });
    assert.deepEqual(
      args.filter((_, i) => args[i - 1] === "--tag"),
      ["a:1", "a:latest"]
    );
  });

  it("renders labels as key=value", () => {
    const args = build({ labels: { "a.b": "1", "c.d": "two words" } });
    const labels = args.filter((_, i) => args[i - 1] === "--label");
    assert.deepEqual(labels, ["a.b=1", "c.d=two words"]);
  });

  it("wires up both cache directions", () => {
    const args = build({ cacheFrom: ["type=local,src=/c"], cacheTo: ["type=local,dest=/c,mode=max"] });
    assert.equal(args[args.indexOf("--cache-from") + 1], "type=local,src=/c");
    assert.equal(args[args.indexOf("--cache-to") + 1], "type=local,dest=/c,mode=max");
  });

  it("drops every cache flag under --no-cache", () => {
    const args = build({ cacheFrom: ["type=local,src=/c"], cacheTo: ["type=local,dest=/c"], noCache: true });
    assert.ok(args.includes("--no-cache"));
    assert.ok(!args.includes("--cache-from"));
    assert.ok(!args.includes("--cache-to"));
  });

  it("omits --platform when none was resolved", () => {
    assert.ok(!build({ platforms: null }).includes("--platform"));
  });
});

describe("cacheEntriesFor", () => {
  const base = { name: "backend", ref: "ghcr.io/o/bettrack/backend", dir: "/cache" };
  const primed = { ...base, cacheExists: () => true };
  const cold = { ...base, cacheExists: () => false };

  it("uses only a local cache for a local build", () => {
    const { cacheFrom, cacheTo } = cacheEntriesFor({ ...primed, push: false });

    assert.deepEqual(cacheFrom, ["type=local,src=/cache/backend"]);
    assert.deepEqual(cacheTo, ["type=local,dest=/cache/backend,mode=max"]);
  });

  it("still writes a cache on the first build, but does not try to read one", () => {
    // buildx warns on every build if asked to import a directory that is not
    // there yet, which is noise on a fresh clone.
    const { cacheFrom, cacheTo } = cacheEntriesFor({ ...cold, push: false });

    assert.deepEqual(cacheFrom, []);
    assert.deepEqual(cacheTo, ["type=local,dest=/cache/backend,mode=max"]);
  });

  it("checks for the cache index, not just the directory", () => {
    const seen = [];
    cacheEntriesFor({ ...base, push: false, cacheExists: (p) => (seen.push(p), false) });
    assert.deepEqual(seen, ["/cache/backend/index.json"]);
  });

  it("adds the shared registry cache when pushing", () => {
    const { cacheFrom, cacheTo } = cacheEntriesFor({ ...primed, push: true });

    assert.equal(cacheFrom[0], "type=registry,ref=ghcr.io/o/bettrack/backend:buildcache");
    assert.ok(cacheTo.some((entry) => entry.startsWith("type=registry")));
  });

  it("uses the registry cache even when there is no local one yet", () => {
    const { cacheFrom } = cacheEntriesFor({ ...cold, push: true });
    assert.deepEqual(cacheFrom, ["type=registry,ref=ghcr.io/o/bettrack/backend:buildcache"]);
  });
});

describe("ociLabels", () => {
  it("covers the same label set docker/metadata-action applies in CI", () => {
    const labels = ociLabels({
      image: { title: "BetTrack Backend", description: "BetTrack dashboard API" },
      version: "0.5.0",
      revision: "abc123",
      created: "2026-08-18T00:00:00.000Z",
      repositoryUrl: "https://github.com/WFord26/BetTrack",
    });

    assert.deepEqual(Object.keys(labels).sort(), [
      "org.opencontainers.image.created",
      "org.opencontainers.image.description",
      "org.opencontainers.image.revision",
      "org.opencontainers.image.source",
      "org.opencontainers.image.title",
      "org.opencontainers.image.url",
      "org.opencontainers.image.version",
    ]);
    assert.equal(labels["org.opencontainers.image.version"], "0.5.0");
    assert.equal(labels["org.opencontainers.image.revision"], "abc123");
  });
});

describe("shellQuote", () => {
  it("leaves ordinary arguments untouched", () => {
    assert.equal(shellQuote("--push"), "--push");
    assert.equal(shellQuote("ghcr.io/o/bettrack/backend:0.5.0"), "ghcr.io/o/bettrack/backend:0.5.0");
    assert.equal(shellQuote("type=local,src=/c/backend"), "type=local,src=/c/backend");
  });

  it("quotes anything with a space, so the printed command survives a paste", () => {
    assert.equal(shellQuote("a.b=two words"), "'a.b=two words'");
  });

  it("escapes embedded single quotes", () => {
    assert.equal(shellQuote("it's"), "'it'\\''s'");
  });
});
