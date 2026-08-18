# BetTrack Release System

One script, [release.mjs](./release.mjs), owns the release sequence. It runs the
same way on a laptop and in CI, so there is a single implementation of "what
does releasing mean" rather than one per workflow.

Versioning is a separate concern and lives in
[bump-version.mjs](./bump-version.mjs) — see [BUMP-SYSTEM.md](./BUMP-SYSTEM.md).
The release script never decides a version level itself; it asks the bump script.

## Quick Start

From the `dashboard/` directory:

```bash
# See exactly what would happen — writes nothing
npm run release:dry

# Release everything under a dated tag
npm run release

# Release one component
npm run release -- mcp
npm run release -- backend
```

The script stops before pushing unless you pass `--push`, and asks for
confirmation first when it has a terminal.

## Scopes

| Scope | Aliases | Packages bumped | Tag | Artifacts CI builds |
|-------|---------|-----------------|-----|---------------------|
| `all` | `full`, `repo` | all four | `yyyy.mm.dd[.N]` | MCPB, both npm packages, both Docker images, both ZIPs |
| `mcp` | `server` | `mcp` | `mcp-vX.Y.Z` | MCPB |
| `dashboard` | `web` | backend, frontend, wrapper | `dashboard-vX.Y.Z` | both npm packages, both Docker images, both ZIPs |
| `backend` | `be`, `api` | `dashboard/backend` | `backend-vX.Y.Z` | backend npm, backend image, backend ZIP |
| `frontend` | `fe`, `ui` | `dashboard/frontend` | `frontend-vX.Y.Z` | frontend npm, frontend image, frontend ZIP |

A component release touches only its own packages. `npm run release -- backend`
does not move the frontend, does not rebuild its image, and does not touch the
`dashboard` wrapper version.

## The Sequence

1. **Plan** — ask `bump-version.mjs --json` for each in-scope package's next
   version and the level it inferred from that package's changelog
2. **Capture notes** — read every in-scope `[Unreleased]` section *before* the
   bump consumes it
3. **Preflight** — see below
4. **Bump** — delegate to `bump-version.mjs`, which writes versions, syncs
   `mcp/manifest.json`, rolls each package changelog, updates internal
   dependency specifiers, and re-baselines `.bump-hashes.json`
5. **Root changelog** — insert the aggregated release block into `CHANGELOG.md`
6. **Commit and tag** — one `chore(release): <tag>` commit, one annotated tag
7. **Push** — only with `--push` or `--ci`

Steps 1–3 write nothing, so `--dry-run` stops after step 3 with the full plan
and the rendered notes.

## Preflight

Every check reports at once rather than failing on the first, so one run tells
you everything that is wrong:

| Check | Override |
|-------|----------|
| On the release branch (`main`) | `--branch <name>` |
| Working tree is clean | `--allow-dirty` |
| Not behind `origin/<branch>` | — (warns instead when origin is unreachable) |
| The target tag is free, locally and on the remote | — |
| At least one package has `[Unreleased]` entries | `--allow-empty-notes` |

`--skip-preflight` disables all of it.

Two failure modes are deliberately warnings rather than errors: if `origin`
cannot be reached, the up-to-date check and the remote tag check are skipped
with a note, because an unreachable remote is not evidence that the tag is free.

`--allow-dirty` is a real footgun — the release commit is `git add -A`, so
unrelated work in the tree gets swept in. The script prints exactly what it is
about to commit when that flag is set.

## Release Notes

Notes are aggregated from the per-package changelogs, so nothing is typed twice
and nothing can go stale. For each in-scope package, the `[Unreleased]` body is
captured before the bump and rendered under a component heading, with its own
headings demoted a level so the document hierarchy stays intact:

```markdown
## [2026.08.18]

### Packages

- **MCP:** v1.1.0
- **Backend:** v0.5.1
- **Frontend:** v0.6.1

### Project

- A repo-wide note from the root CHANGELOG.md

### MCP Server

#### Added

- New `/api/mcp/analytics` surface

### Backend

#### Fixed

- CLV closing-line defect
```

A package with no entries still appears in the `### Packages` version summary
but gets no empty section of its own.

The same text becomes the GitHub Release body — CI reads it from the script
rather than assembling its own.

### The root `[Unreleased]`

A **full** release consumes the root `CHANGELOG.md` `[Unreleased]` section and
renders it as `### Project`. A **component** release does not: those entries
describe repo-wide work, so `npm run release -- mcp` records itself in the root
changelog but leaves the pending project notes in place for the next full
release.

## Workflows

Two entry points, one script:

### `npm run release` → tag push → `release.yml`

The local path. You cut the release on your machine, push, and
[release.yml](../.github/workflows/release.yml) reads the scope back out of the
tag (`release.mjs --from-tag`) and builds only that scope's artifacts.

### `on-demand-release.yml`

The CI path. Pick a scope in the Actions UI; the workflow runs
`release.mjs --ci`, which does everything through the push, then the workflow
publishes npm packages, Docker images, and the GitHub Release. It has a
`dry_run` input that plans without writing.

### Why they do not double-fire

`on-demand-release.yml` pushes its tag, which matches `release.yml`'s trigger —
so both would previously run the full build-and-publish sequence for one
release, including a second push of the `latest` Docker images.

`release.yml` now opens with a `plan` job that checks whether a GitHub Release
already exists for the tag. If it does, the on-demand run has already published
it, and every downstream job skips. A tag pushed from a laptop has no Release
yet, so that path proceeds normally.

## Versioning Is Not Duplicated

Three things used to decide versions independently. Now there is one:

- `scripts/bump-version.mjs` — the only place semver arithmetic happens
- `scripts/release.mjs` — asks the bump script, never computes a version
- `scripts/build.sh` / `build.ps1` — `--version-bump` and `--bump-mcp` /
  `--bump-backend` / `--bump-frontend` / `--bump-dashboard` now map onto bump
  script package targets. Their private `bump_version`/`update_version` and
  `Get-BumpedVersion`/`Update-PackageVersion` implementations were removed —
  they edited manifests directly and skipped the changelog rollover,
  `mcp/manifest.json` sync, and `.bump-hashes.json` entirely

## CI Outputs

With `--ci`, the script appends to `$GITHUB_OUTPUT`:

| Key | Example |
|-----|---------|
| `release_tag` | `2026.08.18` |
| `scope` | `all` |
| `artifacts` | `mcpb,npm-backend,docker-backend,…` |
| `version_mcp` | `1.1.0` |
| `version_dashboard_backend` | `0.5.1` |
| `build_mcpb`, `build_docker_backend`, … | `true` |
| `release_notes` | the rendered markdown, as a heredoc |

Workflow steps gate on `contains(… artifacts, 'docker-backend')` rather than
hardcoding what a release contains.

`--json` prints the same plan to stdout without writing anything, which is how
both workflows preview a release and how `--from-tag` answers "what does this
tag mean".

## Full Workflow

```bash
# 1. Write code, and record it under [Unreleased] in the package's CHANGELOG.md

# 2. Preview
cd dashboard
npm run release:dry

# 3. Cut it
npm run release

# 4. Review, then push
git show
git push origin main --follow-tags
```

Or in one step, with the confirmation prompt still in place:

```bash
npm run release -- --push
```

## Tests

```bash
npm run test:release            # release script only
npm run test:scripts            # release + bump, 127 tests
```

Unit tests cover scope and argument parsing, tag resolution and its inverse,
heading demotion, notes aggregation, root changelog rewriting, and every
preflight rule. The end-to-end tests build a throwaway repo with a real `origin`
remote, copy both scripts in, and drive the CLI as a subprocess — so bumping,
changelog rewriting, committing, tagging, pushing, and the GitHub output
emission are all exercised against real git.

CI runs them in the `Release & Bump Scripts` job, alongside a plan resolution
for every scope against the real manifests.

## Troubleshooting

| Message | Cause / fix |
|---------|-------------|
| "nothing to release" | No `[Unreleased]` entries anywhere. Write changelog entries, or `--allow-empty-notes` |
| "must come from main" | You are on a feature branch. `--branch <name>` if deliberate |
| "Working tree is dirty" | Commit or stash first |
| "Release tag already exists" | That version was already released — bump again |
| "Could not reach origin" | Warning only. The tag may not actually be free remotely |
| CI skipped the release job | A GitHub Release already exists for the tag; on-demand published it |
