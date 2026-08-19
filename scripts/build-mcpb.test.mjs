/**
 * Tests for MCPB packaging.
 *
 * Run with: npm run test:mcpb  (from dashboard/), or
 * `node --test scripts/*.test.mjs`.
 *
 * The end-to-end test builds a real .mcpb from a fixture tree and reads the
 * archive back, because the failure that matters here is a bundle that is
 * missing something Claude Desktop needs.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  McpbError,
  PAYLOAD_FILES,
  PAYLOAD_PACKAGES,
  archiveCommand,
  mcpbFileName,
  parseArgs,
  pickArchiver,
  validatePayload,
} from "./build-mcpb.mjs";

const SCRIPTS_DIR = fileURLToPath(new URL(".", import.meta.url));

// ---------------------------------------------------------------------------
// Payload definition
// ---------------------------------------------------------------------------

describe("payload definition", () => {
  it("requires the files the server cannot start without", () => {
    const required = PAYLOAD_FILES.filter((f) => f.required).map((f) => f.name);

    assert.ok(required.includes("manifest.json"));
    assert.ok(required.includes("sports_mcp_server.py"));
    assert.ok(required.includes("requirements.txt"));
  });

  it("ships dashboard_api, which the server imports at load time", () => {
    // The inline list in on-demand-release.yml omitted this, producing bundles
    // whose entry point could not import.
    assert.ok(PAYLOAD_PACKAGES.includes("dashboard_api"));
    assert.ok(PAYLOAD_PACKAGES.includes("sports_api"));
  });

  it("ships the icon the manifest declares", () => {
    const icon = PAYLOAD_FILES.find((f) => f.name === "icon.png");
    assert.ok(icon, "icon.png must be in the payload");
    assert.equal(icon.required, true);
  });

  it("treats files that are not in the repo yet as optional", () => {
    assert.equal(PAYLOAD_FILES.find((f) => f.name === "LICENSE").required, false);
  });
});

describe("mcpbFileName", () => {
  it("matches the name the release workflows attach", () => {
    assert.equal(mcpbFileName("1.0.1"), "sports-data-mcp-v1.0.1.mcpb");
    assert.equal(mcpbFileName("2.0.0"), "sports-data-mcp-v2.0.0.mcpb");
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe("validatePayload", () => {
  const manifest = {
    version: "1.0.1",
    icon: "icon.png",
    server: { entry_point: "sports_mcp_server.py" },
  };
  const present = new Set(["manifest.json", "sports_mcp_server.py", "icon.png"]);
  const check = (overrides = {}, exists = (n) => present.has(n)) =>
    validatePayload({ manifest, packageVersion: "1.0.1", exists, ...overrides });

  it("passes a complete, in-sync payload", () => {
    assert.deepEqual(check(), []);
  });

  it("catches a manifest/package version desync", () => {
    const problems = check({ packageVersion: "1.0.2" });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /manifest\.json says 1\.0\.1, package\.json says 1\.0\.2/);
  });

  it("skips the version check when the version was given explicitly", () => {
    assert.deepEqual(check({ packageVersion: null }), []);
  });

  it("catches an entry point that is not in the bundle", () => {
    const problems = check({}, (n) => n !== "sports_mcp_server.py" && present.has(n));
    assert.equal(problems.length, 1);
    assert.match(problems[0], /Entry point "sports_mcp_server\.py"/);
  });

  it("catches an icon the manifest references but the bundle lacks", () => {
    // Exactly the defect in every bundle shipped so far.
    const problems = check({}, (n) => n !== "icon.png" && present.has(n));
    assert.equal(problems.length, 1);
    assert.match(problems[0], /Icon "icon\.png"/);
  });

  it("does not demand an icon when the manifest declares none", () => {
    assert.deepEqual(check({ manifest: { ...manifest, icon: undefined } }), []);
  });

  it("reports a manifest with no version or entry point", () => {
    const problems = check({ manifest: { server: {} } });
    assert.equal(problems.length, 2);
  });

  it("handles a missing manifest without throwing", () => {
    assert.equal(validatePayload({ manifest: null, packageVersion: "1.0.0", exists: () => true }).length, 1);
  });

  it("reports every problem at once", () => {
    const problems = validatePayload({
      manifest: { version: "9.9.9", icon: "icon.png", server: { entry_point: "missing.py" } },
      packageVersion: "1.0.1",
      exists: () => false,
    });
    assert.equal(problems.length, 3);
  });
});

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

describe("parseArgs", () => {
  it("defaults to reading the version from the manifest", () => {
    const args = parseArgs([]);
    assert.equal(args.version, null);
    assert.equal(args.fromTag, null);
    assert.equal(args.dryRun, false);
  });

  it("parses valued flags in both spellings", () => {
    assert.equal(parseArgs(["--version", "1.2.3"]).version, "1.2.3");
    assert.equal(parseArgs(["--version=1.2.3"]).version, "1.2.3");
    assert.equal(parseArgs(["--from-tag", "mcp-v1.1.0"]).fromTag, "mcp-v1.1.0");
    assert.equal(parseArgs(["--out-dir", "/tmp/out"]).outDir, "/tmp/out");
  });

  it("parses the switches", () => {
    assert.equal(parseArgs(["--dry-run"]).dryRun, true);
    assert.equal(parseArgs(["--json"]).json, true);
    assert.equal(parseArgs(["--help"]).help, true);
  });

  it("rejects two conflicting version sources", () => {
    assert.throws(() => parseArgs(["--version", "1.0.0", "--from-tag", "mcp-v1.1.0"]), McpbError);
  });

  it("rejects missing values and unknown flags", () => {
    assert.throws(() => parseArgs(["--version"]), McpbError);
    assert.throws(() => parseArgs(["--nonsense"]), McpbError);
  });
});

// ---------------------------------------------------------------------------
// Archiver
// ---------------------------------------------------------------------------

describe("pickArchiver", () => {
  it("prefers zip when it is available", () => {
    assert.equal(pickArchiver({ has: () => true }), "zip");
  });

  it("returns null when nothing can archive, rather than guessing", () => {
    assert.equal(pickArchiver({ has: () => false }), null);
  });
});

describe("archiveCommand", () => {
  it("zips the staging directory's contents, not the directory itself", () => {
    const [command, args] = archiveCommand("zip", { outPath: "/out/pkg.mcpb" });

    assert.equal(command, "zip");
    assert.equal(args.at(args.indexOf("/out/pkg.mcpb") + 1), ".", "archives the cwd contents");
    assert.ok(args.includes("-r"));
  });

  it("excludes compiled Python belt-and-braces", () => {
    const [, args] = archiveCommand("zip", { outPath: "/out/pkg.mcpb" });
    assert.ok(args.includes("*/__pycache__/*"));
    assert.ok(args.includes("*.pyc"));
  });

  it("rejects an archiver it does not know", () => {
    assert.throws(() => archiveCommand("tar", { outPath: "/out/pkg.mcpb" }), McpbError);
  });
});

// ---------------------------------------------------------------------------
// End to end
// ---------------------------------------------------------------------------

const fixtures = [];

after(() => {
  for (const dir of fixtures) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** A minimal mcp/ tree with the script installed alongside it. */
function createFixture({ manifest, packageVersion = "1.0.1" } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "bettrack-mcpb-"));
  fixtures.push(root);

  const write = (relPath, content) => {
    const abs = path.join(root, relPath);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content, "utf8");
  };

  write("mcp/package.json", JSON.stringify({ name: "sports-data-mcp", version: packageVersion }, null, 2));
  write(
    "mcp/manifest.json",
    JSON.stringify(
      manifest ?? {
        name: "sports-data-mcp",
        version: packageVersion,
        icon: "icon.png",
        server: { entry_point: "sports_mcp_server.py" },
      },
      null,
      2
    )
  );

  for (const name of ["sports_mcp_server.py", "dashboard_mcp_server.py", "mcpb_bootstrap.py", "setup.py"]) {
    write(`mcp/${name}`, `# ${name}\n`);
  }
  write("mcp/requirements.txt", "aiohttp>=3.9.0\n");
  write("mcp/icon.png", "not really a png\n");
  write("mcp/.env.example", "ODDS_API_KEY=\n");
  write("mcp/INSTALL_INSTRUCTIONS.md", "# Install\n");

  write("mcp/sports_api/__init__.py", "");
  write("mcp/sports_api/tools.py", "# tools\n");
  write("mcp/dashboard_api/__init__.py", "");
  // Should be excluded from the bundle.
  write("mcp/sports_api/__pycache__/tools.cpython-311.pyc", "compiled");
  write("mcp/sports_api/stale.pyc", "compiled");

  mkdirSync(path.join(root, "scripts"), { recursive: true });
  cpSync(path.join(SCRIPTS_DIR, "build-mcpb.mjs"), path.join(root, "scripts", "build-mcpb.mjs"));

  return root;
}

function runMcpb(root, args = []) {
  return execFileSync("node", [path.join(root, "scripts", "build-mcpb.mjs"), ...args], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function entriesOf(archivePath) {
  return execFileSync("unzip", ["-Z1", archivePath], { encoding: "utf8" }).split("\n").filter(Boolean);
}

describe("build-mcpb CLI (end to end)", () => {
  it("builds an archive named for the manifest version", () => {
    const root = createFixture();
    runMcpb(root);

    const out = path.join(root, "mcp/releases/sports-data-mcp-v1.0.1.mcpb");
    assert.ok(existsSync(out), "the .mcpb was written");
  });

  it("includes every payload file and package", () => {
    const root = createFixture();
    runMcpb(root);

    const entries = entriesOf(path.join(root, "mcp/releases/sports-data-mcp-v1.0.1.mcpb"));

    for (const name of ["manifest.json", "sports_mcp_server.py", "requirements.txt", "icon.png"]) {
      assert.ok(entries.includes(name), `${name} is in the bundle`);
    }
    assert.ok(entries.some((e) => e.startsWith("sports_api/")), "sports_api ships");
    assert.ok(entries.some((e) => e.startsWith("dashboard_api/")), "dashboard_api ships");
  });

  it("excludes compiled Python", () => {
    const root = createFixture();
    runMcpb(root);

    const entries = entriesOf(path.join(root, "mcp/releases/sports-data-mcp-v1.0.1.mcpb"));
    assert.deepEqual(entries.filter((e) => e.includes("__pycache__") || e.endsWith(".pyc")), []);
  });

  it("puts manifest.json at the archive root, where Claude Desktop looks", () => {
    const root = createFixture();
    runMcpb(root);

    const entries = entriesOf(path.join(root, "mcp/releases/sports-data-mcp-v1.0.1.mcpb"));
    assert.ok(entries.includes("manifest.json"), "not nested under a directory");
  });

  it("writes nothing in dry-run mode", () => {
    const root = createFixture();
    const output = runMcpb(root, ["--dry-run"]);

    assert.match(output, /Dry run — nothing written/);
    assert.ok(!existsSync(path.join(root, "mcp/releases")));
  });

  it("reports the result as JSON", () => {
    const root = createFixture();
    const output = runMcpb(root, ["--json"]);
    const result = JSON.parse(output.slice(output.lastIndexOf("{")));

    assert.equal(result.version, "1.0.1");
    assert.match(result.path, /sports-data-mcp-v1\.0\.1\.mcpb$/);
    assert.ok(result.sizeKb >= 0);
    assert.ok(result.entries > 0);
  });

  it("refuses to build when manifest and package versions disagree", () => {
    const root = createFixture({
      manifest: { version: "9.9.9", server: { entry_point: "sports_mcp_server.py" } },
    });

    assert.throws(
      () => runMcpb(root),
      (error) => {
        assert.equal(error.status, 1);
        assert.match(error.stdout + error.stderr, /Version mismatch/);
        return true;
      }
    );

    assert.ok(!existsSync(path.join(root, "mcp/releases")), "nothing was written");
  });

  it("refuses to build when the manifest points at a missing entry point", () => {
    const root = createFixture({
      manifest: { version: "1.0.1", server: { entry_point: "not_shipped.py" } },
    });

    assert.throws(
      () => runMcpb(root),
      (error) => {
        assert.match(error.stdout + error.stderr, /Entry point "not_shipped\.py"/);
        return true;
      }
    );
  });

  it("refuses to build when a required file is missing", () => {
    const root = createFixture();
    rmSync(path.join(root, "mcp/requirements.txt"));

    assert.throws(
      () => runMcpb(root),
      (error) => {
        assert.match(error.stdout + error.stderr, /Required file mcp\/requirements\.txt is missing/);
        return true;
      }
    );
  });

  it("refuses to build when a required package is missing", () => {
    const root = createFixture();
    rmSync(path.join(root, "mcp/dashboard_api"), { recursive: true });

    assert.throws(
      () => runMcpb(root),
      (error) => {
        assert.match(error.stdout + error.stderr, /Required package mcp\/dashboard_api\//);
        return true;
      }
    );
  });

  it("honors an explicit --version without demanding manifest agreement", () => {
    const root = createFixture();
    runMcpb(root, ["--version", "2.0.0"]);

    assert.ok(existsSync(path.join(root, "mcp/releases/sports-data-mcp-v2.0.0.mcpb")));
  });

  it("writes to --out-dir when asked", () => {
    const root = createFixture();
    runMcpb(root, ["--out-dir", "dist-mcpb"]);

    assert.ok(existsSync(path.join(root, "dist-mcpb/sports-data-mcp-v1.0.1.mcpb")));
  });

  it("emits the path for CI to attach to the release", () => {
    const root = createFixture();
    const outputFile = path.join(root, "gh-output.txt");
    writeFileSync(outputFile, "", "utf8");

    execFileSync("node", [path.join(root, "scripts", "build-mcpb.mjs")], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, GITHUB_OUTPUT: outputFile },
    });

    const emitted = readFileSync(outputFile, "utf8");
    assert.match(emitted, /path=mcp\/releases\/sports-data-mcp-v1\.0\.1\.mcpb/);
    assert.match(emitted, /version=1\.0\.1/);
  });
});
