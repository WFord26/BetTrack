# Branch Protection

`main` is protected by a GitHub **repository ruleset** whose definition lives in
this repo at [`.github/rulesets/main-protection.json`](../.github/rulesets/main-protection.json).
The file is the source of truth; GitHub is just where it gets applied.

## What the rules do

| Rule | Effect |
| --- | --- |
| Require a pull request | No direct pushes to `main`. Zero approvals required, so you can merge your own PR — the point is that CI runs first. |
| Required status checks | A PR cannot merge until all six pass: `Backend Tests (22.x)`, `Frontend Tests (22.x)`, `MCP Server Validation (3.11)`, `Release, Bump & Docker Scripts`, `Build Validation`, `Gitleaks`. |
| Block force pushes | `main` history cannot be rewritten. |
| Block deletion | `main` cannot be deleted. |

### Bypass actors: none, and that is a problem to solve

`bypass_actors` is empty, because **this repo is user-owned and GitHub will not
accept the GitHub Actions app as a bypass actor here**. The API rejects it:

```
422 Actor GitHub Actions integration must be part of the ruleset source
    or owner organization
```

Integration bypasses require an organization-owned repository. That matters
because [`on-demand-release.yml`](../.github/workflows/on-demand-release.yml)
runs `scripts/release.mjs` on `main` and pushes the release commit back with
`GITHUB_TOKEN` — a push the ruleset will reject once enforcement is `active`.

The ruleset therefore ships in **`evaluate`** enforcement: GitHub records what
*would* have been blocked and blocks nothing. Resolve the release path before
flipping to `active`. The realistic options:

1. **Release through a PR.** Change `scripts/release.mjs` / the workflow to
   commit the version bump on a branch and open a PR instead of pushing to
   `main`. Keeps protection absolute; costs one workflow change.
2. **Add `RepositoryRole` 5 (repository admin) as a bypass** and give the
   release workflow an admin-owned PAT instead of `GITHUB_TOKEN`. Works, but
   any admin can then push straight to `main`, and it adds a long-lived token
   to maintain.
3. **Move the repo to an organization**, which unlocks the GitHub Actions
   integration bypass and the original design.

## Releasing

Releasing from a laptop (`npm run release -- --push`) pushes a commit straight to
`main`. Under `evaluate` that still works; under `active` it will be rejected.
The **On-Demand Release** workflow is the intended path:

```bash
gh workflow run on-demand-release.yml -f scope=all
```

It runs the same `scripts/release.mjs`. Note that its push to `main` is subject
to the same rules — see the bypass section above before enabling enforcement.
See [RELEASE-PROCESS.md](RELEASE-PROCESS.md) for scopes and version bumping.

## Local guard

`scripts/hooks/pre-push` refuses a push to `main` before it leaves your machine,
so you get a useful message instead of a server rejection. Install it once per
clone:

```bash
./scripts/install-git-hooks.sh
```

To bypass it for one command (the server will still reject the push):

```bash
BETTRACK_ALLOW_MAIN_PUSH=1 git push origin main
```

## Changing the rules

Edit the JSON, then apply it:

```bash
./scripts/apply-branch-protection.sh
```

To see what is live right now:

```bash
./scripts/apply-branch-protection.sh --show
```

The file ships with `"enforcement": "evaluate"`. Change it to `"active"` and
re-apply to start blocking; `"disabled"` turns it off without deleting it.

Two more knobs worth knowing:

- **Required check names embed the matrix version.** Bumping Node to `24.x` or
  Python to `3.12` in [`test.yml`](../.github/workflows/test.yml) renames the
  check, and the old name stays required and never reports — PRs hang. Update
  the contexts in the JSON in the same commit as any version bump.
- **`strict_required_status_checks_policy` is `false`**, so a PR can merge
  without being rebased onto the newest `main`. Set it to `true` to require
  branches be up to date first, at the cost of re-running CI whenever `main`
  moves.
