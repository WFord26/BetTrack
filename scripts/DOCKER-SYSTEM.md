# BetTrack Docker Images

Two images, built by [docker-build.mjs](./docker-build.mjs) locally and by
GitHub Actions in CI.

Related: [RELEASE-SYSTEM.md](./RELEASE-SYSTEM.md) · [BUMP-SYSTEM.md](./BUMP-SYSTEM.md)

## Images

| Image | Dockerfile | Context | Serves |
|-------|-----------|---------|--------|
| `ghcr.io/<owner>/bettrack/backend` | `dashboard/backend/Dockerfile` | `dashboard/` | Express API on :3001 |
| `ghcr.io/<owner>/bettrack/frontend` | `dashboard/frontend/Dockerfile` | `dashboard/` | nginx serving the SPA on :80 |

**The build context is `dashboard/`, not the component directory.** Both
Dockerfiles install from the shared workspace lockfile, so `cd dashboard/backend
&& docker build .` cannot work — the context would have no `backend/` subtree.
The script handles this; by hand it is `docker build -f backend/Dockerfile .`
from `dashboard/`.

The MCP server has no image. It ships as an MCPB package — see
[RELEASE-SYSTEM.md](./RELEASE-SYSTEM.md).

## Tags

Each tag means one thing, and only one workflow moves it:

| Tag | Meaning | Moved by |
|-----|---------|----------|
| `:latest` | the newest **release** | `release.yml`, `on-demand-release.yml`, or a local `--latest` |
| `:<version>` | one released version, immutable | the release workflows |
| `:edge` | the tip of `main` | `docker-publish.yml` |
| `:main-<sha>` | one `main` commit, immutable | `docker-publish.yml` |
| `:buildcache` | the shared buildx cache layer | any pushing build |

`docker-publish.yml` used to push `:<version>` and `:latest` on every `main`
push, so a release commit was built twice — once there and once by `release.yml`
for the tag, both racing to move `:latest`. It now publishes only `edge` and
`main-<sha>`, and skips entirely when the commit already carries a release tag.

## Quick Start

From the `dashboard/` directory:

```bash
# Build locally for your own architecture
npm run docker:build -- backend
npm run docker:build -- all

# See the exact buildx commands, run nothing
npm run docker:dry

# Build and push multi-arch to GHCR
export GITHUB_TOKEN="$(gh auth token)"      # see docs/CREDENTIALS.md
npm run docker:build -- all --push

# Also move :latest (clean tree on main only)
npm run docker:build -- all --push --latest

# Rebuild exactly what a past release published
npm run docker:build -- all --from-tag 2026.08.18 --push
```

Targets accept the same words as `npm run release`: `backend` (`be`, `api`),
`frontend` (`fe`, `ui`), `dashboard` / `all` (`web`). The old `--backend`,
`--frontend` and `--all` flags still work.

## Multi-Arch, and Why the Old Script Broke

The previous shell scripts ran:

```bash
docker build --platform linux/amd64,linux/arm64 -t backend:0.5.0 .
docker tag  backend:0.5.0 ghcr.io/.../backend:0.5.0
docker push ghcr.io/.../backend:0.5.0
```

Classic `docker build` cannot put a manifest list in the local image store
unless the containerd image store is enabled, so on a stock Docker install the
default flags failed outright with *"Multi-platform build is not supported for
the docker driver."* On a machine that does have containerd enabled it appeared
to work, which is why it survived — it broke only for other people.

Multi-platform is a single `docker buildx build --push`; the image never lands
locally at all. The script therefore has two modes:

| Mode | Platforms | Exporter |
|------|-----------|----------|
| local (no `--push`) | the host platform only | `--load` |
| `--push` | `linux/amd64,linux/arm64` | `--push` |

Asking for multiple platforms without `--push` is refused with an explanation
rather than a Docker error, because there is no single-platform form to load.

## The `latest` Guard

`:latest` is what every `docker pull` without a tag receives, so moving it takes
more than a flag:

- `--latest` must be given explicitly — `--push` alone never touches it
- the current branch must be `main`
- the working tree must be clean (`--allow-dirty` overrides)

All failing reasons are reported at once:

```
❌ Refusing to move :latest
   • latest may only be moved from "main" — you are on "feature/x".
     A stray build would become what everyone pulls.
   • latest may only be moved from a clean tree, so the image matches
     a real commit. Use --allow-dirty to override.
```

## Versions

An image tag always matches what is inside it, because the version is never
hand-typed by default:

1. `--version <v>` — explicit override
2. `--from-tag <tag>` — the versions a past release published, via
   `release.mjs --from-tag`
3. otherwise — the current manifest versions, via `bump-version.mjs --json`

`--version` and `--from-tag` together are refused; they are two answers to the
same question.

## Caching

| Where | Cache |
|-------|-------|
| local build | `type=local` under `.docker-cache/<image>` (gitignored) |
| local `--push` | the local cache plus `type=registry,ref=<image>:buildcache` |
| CI | `type=gha`, scoped per component |

`--no-cache` drops all of it.

## Labels

The script applies the same OCI label set as CI's `docker/metadata-action`, so
an image built on a laptop is indistinguishable from a CI one:

`source`, `url`, `version`, `revision` (the git SHA), `created`, `title`,
`description`.

## Package Visibility

GHCR packages are private on first push. After a **successful** push the script
flips them public through the GitHub API, and reports rather than fails if the
token lacks the scope. `--no-public` skips it.

The old scripts called this unconditionally, including after a push that had
failed.

## Shell Wrappers

`docker-build.sh` and `docker-build.ps1` are now one-line shims that forward to
`docker-build.mjs`. They were 321 and 389 lines of parallel implementation kept
in sync by hand. The PowerShell shim translates `-Backend` style switches to
`--backend`, so existing commands keep working.

## Tests

```bash
npm run test:docker      # docker script only
npm run test:scripts     # bump + release + docker
```

There are no end-to-end tests — building an image needs a daemon and minutes per
run. Instead the command assembly is a pure function, so the exact
`docker buildx build` invocation is asserted directly, which is where the old
scripts' bugs actually lived: that `--push` is part of the build rather than a
later `docker push`, that a local build uses `--load` and one platform, that
cache flags disappear under `--no-cache`, and that the context comes last.

CI additionally runs `docker-build.mjs all --dry-run`, which needs no daemon and
catches a moved Dockerfile or a renamed package key.

## Troubleshooting

| Message | Cause / fix |
|---------|-------------|
| "Cannot build …,… without --push" | Multi-platform images cannot be loaded locally. Add `--push` or pick one `--platform` |
| "docker buildx is not available" | Install the Buildx plugin; multi-platform needs it |
| "Refusing to move :latest" | Switch to `main` and commit, or drop `--latest` |
| "GITHUB_TOKEN is not set" | `export GITHUB_TOKEN="$(gh auth token)"` |
| "could not set … public (HTTP 403)" | Token lacks `write:packages`. Set visibility in GitHub → Packages |
| Pulled `:latest` is older than expected | `:latest` tracks releases, not `main`. Use `:edge` for the tip of main |
