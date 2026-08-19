# BetTrack Version Bump System

Four independently versioned packages, each bumpable on its own schedule, with
the bump level derived from the package's own changelog.

Quick reference: [BUMP-QUICK-START.md](./BUMP-QUICK-START.md)  
Releasing: [RELEASE-SYSTEM.md](./RELEASE-SYSTEM.md)

## Packages

| Key | CLI aliases | Manifest | Scope |
|-----|-------------|----------|-------|
| `mcp` | `server` | `mcp/package.json` | FastMCP server, sports API handlers, formatters |
| `dashboard/backend` | `backend`, `be`, `api` | `dashboard/backend/package.json` | Express API, Prisma, services, jobs |
| `dashboard/frontend` | `frontend`, `fe`, `ui` | `dashboard/frontend/package.json` | React components, Redux store, UI |
| `dashboard` | `monorepo`, `workspace` | `dashboard/package.json` | The npm workspace wrapper |

Current versions live in those manifests — this document deliberately does not
duplicate them.

`mcp/manifest.json` is a mirror, not a package: Claude Desktop reads it, and the
script keeps its `version` in sync with `mcp/package.json` on every mcp bump.

`dashboard` is an **aggregate**. It owns no sources of its own (every file under
`dashboard/` already belongs to backend or frontend), so it is never hashed. It
rolls forward whenever one of its workspaces does.

## Command Line

All commands run from `dashboard/`. Anything after `--` goes to the script.

```bash
npm run bump                                  # interactive checklist
npm run bump -- mcp:minor frontend:patch      # explicit packages, explicit levels
npm run bump -- backend                       # explicit package, inferred level
npm run bump:ci                               # every changed package, no prompt
npm run bump:dry                              # same, but writes nothing
npm run bump -- --force minor                 # override the level everywhere
npm run bump -- --since origin/main           # detect changes against a git ref
npm run bump:tag                              # tag current versions at HEAD
npm run bump -- --help
```

### Options

| Option | Effect |
|--------|--------|
| `<pkg>[:<level>]` | Target a package. Repeatable. A bare name uses the inferred level |
| `--force <level>` | Apply this level to every selected package (a bare `patch`/`minor`/`major` is the legacy spelling) |
| `--dry-run` | Report the plan, write nothing |
| `--no-input` | Never prompt. Implied automatically when stdin is not a TTY |
| `--since <ref>` | Detect changes via `git diff <ref>...HEAD` instead of the stored hashes |
| `--tag` | Tag mode: create per-package tags at HEAD, no version writes |
| `--allow-dirty` | Tag mode only: tag despite a dirty working tree |

## Level Inference

The level for each package comes from its own `CHANGELOG.md`, reading only the
`[Unreleased]` section — everything from the `## [Unreleased]` heading down to
the next `##` heading or a `---` separator.

| Signal | Level |
|--------|-------|
| A `### Removed` section with at least one entry | `major` |
| The text `BREAKING CHANGE` (or `**BREAKING`, `BREAKING:`) anywhere in the section | `major` |
| An `### Added` section with at least one entry | `minor` |
| Only `Changed` / `Fixed` / `Security` / `Deprecated` / `Performance` | `patch` |
| Bullets with no `###` headings at all | `patch` |
| Section empty, or no changelog file | no signal → `patch` |

Two details worth knowing:

- **Empty headings do not count.** A `### Added` with nothing under it is
  ignored, so a scaffolded changelog template will not silently produce minors.
- **Released sections are never read.** Only `[Unreleased]` is parsed, so the
  `### Added` belonging to last month's release cannot leak into today's level.

### Precedence

For each package, first match wins:

1. An explicit `pkg:level` argument → `requested`
2. `--force <level>` → `--force`
3. The changelog inference above → the matched reason
4. *(aggregate only)* the highest level any of its workspaces took this run
5. `patch`

The reason is printed next to every planned bump, so a surprising level is
always traceable:

```
🚀 Planned bumps:
   mcp                  1.0.0 → 1.1.0  (minor — [Unreleased] has an Added section)
   dashboard/frontend   0.6.0 → 0.6.1  (patch — [Unreleased] has only changed, fixed)
   dashboard            0.3.0 → 0.3.1  (patch — highest of its workspaces (patch))
```

## Change Detection

Detection decides what is **preselected**, never what is *permitted* — naming a
package always bumps it, changed or not.

1. Every tracked file under each hashed package is SHA-256'd
2. The per-file digests are folded into one package digest
3. That digest is compared against `.bump-hashes.json` at the repo root
4. A package with no stored digest, or a differing one, counts as changed

Not hashed: `package.json`, `CHANGELOG.md`, `*.tsbuildinfo`, and anything under
`dist/`, `node_modules/`, `.git/`, `coverage/`, `__pycache__/`, `.pytest_cache/`.
Excluding `package.json` and `CHANGELOG.md` is what stops a bump from being
self-triggering.

With `--since <ref>`, git decides instead: the union of `git diff <ref>...HEAD`,
uncommitted changes, and untracked files, mapped back onto package directories.

### Baselining

Only the packages actually bumped are re-baselined, and they are re-hashed
*after* the writes land. Both halves matter:

- Re-baselining just the bumped packages means a package you deliberately
  skipped still shows as changed on the next run, instead of being silently
  absorbed.
- Re-hashing after the write is required because the bump edits a hashed file:
  `mcp/manifest.json`. Storing the pre-write snapshot would leave mcp reporting
  as changed forever.

## Interactive Mode

Bare `npm run bump` with a TTY opens a checklist of every package, preselecting
the changed ones at their inferred level:

```
Select packages to bump:
  ↑/↓ move · space toggle · ←/→ level · a all · n none · enter confirm · q cancel

❯ [x] mcp                 1.0.0 → 1.1.0  (minor)
  [ ] dashboard/backend   0.5.0  (skip) · no source changes detected
  [x] dashboard/frontend  0.6.0 → 0.6.1  (patch)
  [x] dashboard           0.3.0 → 0.3.1  (patch)
```

`←`/`→` cycles the level on the highlighted row (and selects it). `q`, `esc`, or
`ctrl-c` exits without writing anything.

Providing explicit targets skips the prompt entirely, as does `--no-input` and
any non-TTY stdin — CI cannot hang here.

## What a Bump Writes

For each selected package:

1. `version` in its `package.json`
2. `version` in any mirror file (`mcp/manifest.json`)
3. `CHANGELOG.md`: the `[Unreleased]` entries move down under a new
   `## [x.y.z] - YYYY-MM-DD` header, and an empty `[Unreleased]` stays at the
   top for the next cycle
4. Internal dependency specifiers on *other* packages that depend on it,
   preserving the range operator (`^0.5.0`, `~0.5.0`, `workspace:^0.5.0`,
   exact). Specifiers it cannot safely rewrite — `file:`, ranges, `*` — are left
   alone
5. `.bump-hashes.json`

Nothing is committed, staged, or pushed.

## Tagging

Tags must point at the commit that carries the new version, and that commit does
not exist until you make it — so tagging is a separate step:

```bash
npm run bump -- mcp:minor
git add -A && git commit -m "chore: bump mcp"
npm run bump:tag
git push origin main --follow-tags
```

`bump:tag` reads the current manifest versions and creates one annotated tag per
package, named from the last path segment so nothing collides:

| Package | Tag |
|---------|-----|
| `mcp` | `mcp-v1.1.0` |
| `dashboard/backend` | `backend-v0.5.0` |
| `dashboard/frontend` | `frontend-v0.6.0` |
| `dashboard` | `dashboard-v0.3.0` |

Behavior:

- Refuses on a dirty working tree, listing what is uncommitted. `--allow-dirty`
  overrides; `--dry-run` warns but still shows the preview
- Skips tags that already exist rather than failing, so re-running is safe
- Never pushes — it prints the exact `git push` command
- Honors `--dry-run` and package filters: `npm run bump:tag -- mcp backend`

Note that the repo also carries date-shaped release tags (`2026.05.14`,
`2026.08.16`) consumed by `.github/workflows/release.yml`. Per-package tags are
a separate namespace and do not trigger that workflow.

## Tests

```bash
npm run test:bump              # from dashboard/
npm run test:scripts           # every script suite
node --test scripts/*.test.mjs
```

65 tests, no dependencies beyond `node:test`. Unit tests cover level inference,
argument parsing, semver arithmetic, dependency specifier rewriting, changelog
rewriting, and plan construction. The end-to-end tests build a throwaway repo in
a temp directory, copy the real script into it, and drive the actual CLI as a
subprocess — so version writes, changelog rewrites, hash baselining, and git
tagging are all exercised for real.

CI runs both the suite and a `--dry-run` against the real manifests (the
`Release & Bump Scripts` job in `.github/workflows/test.yml`), which catches a
manifest that has drifted off semver or a changelog the parser cannot read.

## Extending

To track another package, add an entry to `PACKAGE_CONFIGS` in
[bump-version.mjs](./bump-version.mjs):

```js
{
  key: "tools/cli",
  aliases: ["cli"],
  manifestPath: "tools/cli/package.json",
  trackedDirs: ["tools/cli"],
  extraVersionFiles: [],   // optional version mirrors
}
```

`AGGREGATE_CONFIGS` takes the same shape minus `trackedDirs`, plus a `members`
array of the keys it follows.
