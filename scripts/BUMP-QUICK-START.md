# Bump Script Quick Reference

Full reference: [BUMP-SYSTEM.md](./BUMP-SYSTEM.md) · Releasing: [RELEASE-SYSTEM.md](./RELEASE-SYSTEM.md)

## Quick Start

From the `dashboard/` directory:

```bash
# Pick packages and levels interactively
npm run bump

# Bump exactly these, at these levels
npm run bump -- mcp:minor frontend:patch

# Bump one package at whatever level its changelog implies
npm run bump -- backend

# Bump every changed package, no prompt (CI)
npm run bump:ci

# Preview without writing
npm run bump:dry

# Tag the current versions — run AFTER committing the bump
npm run bump:tag
```

## Package Names

| Name | Aliases | Manifest |
|------|---------|----------|
| `mcp` | `server` | `mcp/package.json` (+ `mcp/manifest.json`) |
| `dashboard/backend` | `backend`, `be`, `api` | `dashboard/backend/package.json` |
| `dashboard/frontend` | `frontend`, `fe`, `ui` | `dashboard/frontend/package.json` |
| `dashboard` | `monorepo`, `workspace` | `dashboard/package.json` |

Each is versioned independently — bump one, all, or any subset, whenever you want.

## How the Level Is Chosen

Read from the package's own `CHANGELOG.md`, `[Unreleased]` section only:

| What's in `[Unreleased]` | Level |
|--------------------------|-------|
| A populated `### Removed`, or the text `BREAKING CHANGE` | **major** |
| A populated `### Added` | **minor** |
| Only `Changed` / `Fixed` / `Security` / `Deprecated` | **patch** |
| Nothing, or no changelog | **patch** (default) |

Empty section headings are ignored, so an `### Added` scaffold with no bullets
under it will not inflate a patch into a minor.

Precedence, highest first:

1. An explicit `pkg:level` on the command line
2. `--force <level>` (applies to every selected package)
3. The changelog inference above
4. `patch`

The `dashboard` wrapper is the exception to nothing — it just has one extra
fallback. With no signal of its own it takes the highest level any of its
workspaces took in the same run.

## Interactive Mode

Bare `npm run bump` in a terminal opens a checklist:

```
Select packages to bump:
  ↑/↓ move · space toggle · ←/→ level · a all · n none · enter confirm · q cancel

❯ [x] mcp                 1.0.0 → 1.1.0  (minor)
  [ ] dashboard/backend   0.5.0  (skip)
  [x] dashboard/frontend  0.6.0 → 0.6.1  (patch)
  [x] dashboard           0.3.0 → 0.3.1  (patch)
```

Packages that changed are preselected at their inferred level; `←`/`→` overrides
the level on the highlighted row. It falls back to non-interactive mode
automatically when stdin is not a TTY, so CI never hangs.

## Full Workflow

```bash
# 1. Write code, and record it under [Unreleased] in the package's CHANGELOG.md
# 2. Bump
cd dashboard
npm run bump

# 3. Review
git diff

# 4. Commit — use `add -A`, not `commit -a`, so .bump-hashes.json is included
git add -A && git commit -m "chore: bump versions"

# 5. Tag (needs the bump committed first — tags point at HEAD)
npm run bump:tag
git push origin main --follow-tags
```

## What a Bump Writes

- `<pkg>/package.json` — the new version
- `mcp/manifest.json` — kept in sync with `mcp/package.json` for Claude Desktop
- `<pkg>/CHANGELOG.md` — `[Unreleased]` entries move under `## [x.y.z] - <date>`;
  an empty `[Unreleased]` stays at the top for the next cycle
- Internal dependency specifiers on packages that depend on a bumped one
- `.bump-hashes.json` — re-baselined for the bumped packages only, so a package
  you chose to skip still shows as changed next run

## Change Detection

SHA-256 hashes of every tracked file, compared against `.bump-hashes.json`.
Not hashed: `package.json`, `CHANGELOG.md`, `*.tsbuildinfo`, and anything under
`dist/`, `node_modules/`, `coverage/`, `__pycache__/`, `.pytest_cache/`.

Use `--since <git-ref>` to detect against a git ref instead of the stored hashes.

Detection only decides what is *preselected*. Naming a package always bumps it,
changed or not.

## Tags

`npm run bump:tag` creates one annotated tag per package: `mcp-v1.1.0`,
`backend-v0.5.0`, `frontend-v0.6.0`, `dashboard-v0.3.0`. It refuses on a dirty
working tree (the tag would point at the pre-bump commit), skips tags that
already exist, and never pushes — it prints the `git push` command instead.

Restrict it to specific packages the same way: `npm run bump:tag -- mcp`.

## Troubleshooting

| Issue | Cause / fix |
|-------|-------------|
| "No changes detected" | Nothing changed since the last baseline. Name a package to bump it anyway: `npm run bump -- frontend:minor` |
| Everything bumps as patch | The `[Unreleased]` sections are empty — record changes there first, or pass an explicit level |
| Wanted minor, got patch | The `### Added` heading has no bullets under it |
| Tag step says "dirty" | Commit the bump first; tags attach to HEAD |
| A package keeps reappearing as changed | An untracked-but-hashed file is being rewritten by a build. Check the ignore list |

## Tests

```bash
npm run test:bump      # bump script only
npm run test:scripts   # every script suite
```
