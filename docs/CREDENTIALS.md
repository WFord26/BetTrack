# Credentials and Secrets

Where every credential this project uses is supposed to live, and what must
never sit in the working tree.

## The rule

**No live credential belongs at the repository root.** The root `.env` is not
read by any code in this project. A token sitting there is one `git add -f`,
one `tar czf`, or one misconfigured backup away from leaving the machine.

Per component `.env` files are fine, because the component that reads them is
the component that owns them, and each is covered by `.gitignore`.

## GITHUB_TOKEN

Used for two things: pushing images to GitHub Container Registry
(`scripts/docker-build.ps1`, `scripts/docker-build.sh`) and creating releases.

### Preferred: the gh CLI keyring

The `gh` CLI stores credentials in the OS keychain, not on disk in plaintext.

```bash
gh auth login --scopes "repo,write:packages"
```

Then read it out only at the moment it is needed:

```bash
# bash / zsh
echo "$(gh auth token)" | docker login ghcr.io -u <owner> --password-stdin
```

```powershell
# PowerShell
gh auth token | docker login ghcr.io -u <owner> --password-stdin
```

The build scripts still expect `GITHUB_TOKEN` in the environment. Export it for
the life of the shell rather than persisting it:

```bash
export GITHUB_TOKEN="$(gh auth token)"
```

```powershell
$env:GITHUB_TOKEN = (gh auth token)
```

### Alternative: shell profile

If you would rather not depend on `gh`, put the PAT in your shell profile,
which lives in your home directory and outside every repository:

```bash
# ~/.zprofile or ~/.bash_profile
export GITHUB_TOKEN="ghp_..."
```

```powershell
# $PROFILE
$env:GITHUB_TOKEN = "ghp_..."
```

Restrict the file so only you can read it: `chmod 600 ~/.zprofile`.

### In CI

Nothing to configure. GitHub Actions injects `secrets.GITHUB_TOKEN`
automatically. No workflow in `.github/workflows/` needs a manually created
PAT for GHCR or npm publishing.

## ODDS_API_KEY

The Odds API key that the MCP server and the dashboard backend use.

This one is genuinely application configuration, so it stays in a `.env` file,
but in the `.env` of the component that reads it:

| File | Read by | Template |
| --- | --- | --- |
| `mcp/.env` | `mcp/sports_mcp_server.py` via `load_dotenv` | `mcp/.env.example` |
| `dashboard/backend/.env` | dashboard backend | `dashboard/backend/.env.example` |

For a packaged MCP install, the server reads its `.env` from the persistent
config directory rather than the repository. See `mcp/INSTALL_INSTRUCTIONS.md`.

Get a key at https://the-odds-api.com. See `docs/wiki/Getting-API-Key.md`.

Do **not** copy `ODDS_API_KEY` into the repository root `.env`. Nothing reads
it there.

## DASHBOARD_API_KEY

Read by `mcp/dashboard_api/client.py` so the MCP server can talk to a running
dashboard. Same rule: it belongs in `mcp/.env`, alongside `ODDS_API_KEY`.

## What is protected already

`.gitignore` line 100 is a bare `.env` pattern, which git applies at every
directory depth. `git ls-files | grep '\.env'` returns only `.example`
variants, so no secret has ever been committed.

The `Secret Scan` workflow (`.github/workflows/secret-scan.yml`) runs gitleaks
on every push and pull request as a backstop. To catch a mistake before it
becomes a commit, install the local hook:

```bash
./scripts/install-git-hooks.sh
```

## If a token is exposed

1. Revoke it immediately at https://github.com/settings/tokens (or the
   provider's equivalent). Revoking is the only fix that matters; rewriting
   history is not a substitute.
2. Issue a replacement with the narrowest scopes that still work.
3. Store the replacement per this document.
4. If the value ever reached a commit, rewrite history with `git filter-repo`
   and force push, but only after step 1.
