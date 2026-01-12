# Quick Release Reference

## TL;DR - Run a Full Release

```powershell
# 1. Set GitHub token (first time only)
$env:GITHUB_TOKEN = "your_github_pat_token"

# 2. Navigate to build scripts
cd scripts

# 3. Run full release with Docker push
.\build.ps1 -FullRelease -VersionBump patch -PushDocker
```

That's it! This creates:
- ✅ MCP package (.mcpb)
- ✅ Backend ZIP
- ✅ Frontend ZIP
- ✅ Docker images (backend + frontend)
- ✅ GitHub release with all artifacts
- ✅ Release tag: `YYYY.MM.DD` format

## Common Commands

```powershell
# Patch release (bug fixes)
.\build.ps1 -FullRelease -VersionBump patch -PushDocker

# Minor release (new features)
.\build.ps1 -FullRelease -VersionBump minor -PushDocker

# Major release (breaking changes)
.\build.ps1 -FullRelease -VersionBump major -PushDocker

# Build locally without pushing Docker
.\build.ps1 -FullRelease -VersionBump patch

# Clean previous builds
.\build.ps1 -Clean
```

## Deploying with Docker

After release, deploy using production compose file with Docker secrets:

```bash
# Setup secrets directory
mkdir -p dashboard/secrets
echo -n "your_odds_api_key" > dashboard/secrets/odds_api_key.txt
echo -n "$(openssl rand -hex 32)" > dashboard/secrets/session_secret.txt
echo -n "sports_user" > dashboard/secrets/db_user.txt
echo -n "secure_password" > dashboard/secrets/db_password.txt

# Secure the files
chmod 600 dashboard/secrets/*.txt

# Deploy
cd dashboard
docker-compose -f docker-compose.prod.yml up -d
```

**Alternative**: Use environment variables for development:
```bash
export DATABASE_URL="postgresql://user:pass@localhost/db"
export ODDS_API_KEY="your_api_key"
docker-compose up
```

See [dashboard/secrets/README.md](../dashboard/secrets/README.md) for advanced secret management (AWS, Azure, Kubernetes).

## What Gets Created

### Files
- `mcp/releases/sports-data-mcp-v*.mcpb`
- `mcp/releases/backend.v*.zip`
- `mcp/releases/frontend.v*.zip`

### Docker Images
- `ghcr.io/<owner>/bettrack-backend:YYYY.MM.DD`
- `ghcr.io/<owner>/bettrack-backend:latest`
- `ghcr.io/<owner>/bettrack-frontend:YYYY.MM.DD`
- `ghcr.io/<owner>/bettrack-frontend:latest`

### Git
- Tag: `YYYY.MM.DD` (or `YYYY.MM.DD.N` if multiple releases same day)
- Commit with version bumps
- GitHub release with all artifacts

## Version Numbers

**Release Tag**: `2026.01.12` (calendar-based)  
**MCP Version**: `0.1.15` (semver)  
**Dashboard Version**: `0.2.4` (semver)  
**Backend Version**: `0.1.22` (semver)  
**Frontend Version**: `0.2.4` (semver)

## Prerequisites

### First Time Setup
```powershell
# Install GitHub CLI (for releases)
winget install GitHub.cli

# Authenticate
gh auth login

# Create GitHub PAT (for Docker push)
# Go to: https://github.com/settings/tokens
# Scopes: write:packages, repo
$env:GITHUB_TOKEN = "ghp_your_token_here"

# Verify Docker
docker --version
docker login ghcr.io -u <username>
```

### Every Release
```powershell
# Set GitHub token (if not in profile)
$env:GITHUB_TOKEN = "your_token"
```

## Automated Release (GitHub Actions)

```bash
# Just push a calendar tag - GitHub Actions does the rest
git tag 2026.01.12
git push origin 2026.01.12
```

## Build Components Separately

```powershell
# MCP only
.\build.ps1 -MCP -VersionBump patch -BumpMCP

# Dashboard only
.\build.ps1 -Dashboard -VersionBump patch -BumpBackend -BumpFrontend

# Docker only
.\docker-build.ps1 -Version "2026.01.12" -Backend -Frontend -Push
```

## Pull Published Images

```bash
# Latest versions
docker pull ghcr.io/<owner>/sports-odds-mcp-backend:latest
docker pull ghcr.io/<owner>/sports-odds-mcp-frontend:latest

# Specific release
docker pull ghcr.io/<owner>/sports-odds-mcp-backend:2026.01.12
docker pull ghcr.io/<owner>/sports-odds-mcp-frontend:2026.01.12
```

## Troubleshooting

**Docker push fails**: Check `$env:GITHUB_TOKEN` is set  
**GitHub release fails**: Run `gh auth login`  
**Build fails**: Run `.\build.ps1 -Clean` first  
**Wrong versions**: Check package.json files manually

## Full Documentation

See [RELEASE-PROCESS.md](RELEASE-PROCESS.md) for complete details.
