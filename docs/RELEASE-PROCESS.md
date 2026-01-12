# Release Process Guide

## Overview

The Sports-Odds-MCP project uses a comprehensive release system that builds and publishes:
- MCP server package (.mcpb)
- Dashboard backend and frontend (dist ZIPs)
- Docker images for both components
- GitHub releases with all artifacts

## Release Versioning

### Calendar-Based Release Tags
Releases use calendar versioning: `YYYY.MM.DD` or `YYYY.MM.DD.N`

**Examples:**
- `2026.01.12` - First release on January 12, 2026
- `2026.01.12.2` - Second release on the same day
- `2026.02.05` - Release on February 5, 2026

### Component Versions (Semantic Versioning)
Individual components use semantic versioning (semver):
- MCP Server: `0.1.14`, `0.2.0`, etc.
- Dashboard: `0.2.3`, `1.0.0`, etc.
- Backend: `0.1.21`, `0.2.0`, etc.
- Frontend: `0.2.3`, `1.0.0`, etc.

## Quick Start

### Full Release (Recommended)

```powershell
# Navigate to build script directory
cd mcp/scripts/build

# Patch release (most common)
.\build.ps1 -FullRelease -VersionBump patch

# With Docker push to GitHub Container Registry
$env:GITHUB_TOKEN = "your_github_pat_token"
.\build.ps1 -FullRelease -VersionBump patch -PushDocker

# Minor or major releases
.\build.ps1 -FullRelease -VersionBump minor
.\build.ps1 -FullRelease -VersionBump major
```

This single command:
1. Cleans previous builds
2. Builds Dashboard (backend + frontend)
3. Builds MCP server package
4. Bumps all component versions
5. Creates distribution ZIPs
6. Builds Docker images (optionally pushes)
7. Creates GitHub release with all artifacts

## Manual Release Process

If you need more control, build components separately:

### Step 1: Build MCP Server

```powershell
cd mcp/scripts/build
.\build.ps1 -MCP -VersionBump patch -BumpMCP
```

### Step 2: Build Dashboard

```powershell
.\build.ps1 -Dashboard -VersionBump patch -BumpBackend -BumpFrontend
```

### Step 3: Build Docker Images

```powershell
# Get calendar version
$releaseTag = (Get-Date).ToString("yyyy.MM.dd")

# Build and push Docker images
.\docker-build.ps1 -Version $releaseTag -Backend -Frontend -Push
```

### Step 4: Create Distribution ZIPs

Distribution ZIPs are created automatically by `-FullRelease`, but you can also create them manually by copying from `dashboard/dist/`:

```powershell
# After building dashboard
cd mcp/releases
Compress-Archive -Path "../../dashboard/dist/backend/*" -DestinationPath "backend.v0.2.3.zip"
Compress-Archive -Path "../../dashboard/dist/frontend/*" -DestinationPath "frontend.v0.2.3.zip"
```

## Docker Images

### Prerequisites

1. **GitHub Personal Access Token** with `write:packages` permission
2. **Set environment variable**:
   ```powershell
   $env:GITHUB_TOKEN = "ghp_your_token_here"
   ```

### Manual Docker Build & Push

```powershell
cd mcp/scripts/build

# Build only (no push)
.\docker-build.ps1 -Version "2026.01.12" -Backend -Frontend

# Build and push
.\docker-build.ps1 -Version "2026.01.12" -Backend -Frontend -Push

# Multi-architecture builds (default)
.\docker-build.ps1 -Version "2026.01.12" -Backend -Platform "linux/amd64,linux/arm64" -Push

# Single architecture (faster)
.\docker-build.ps1 -Version "2026.01.12" -Frontend -Platform "linux/amd64" -Push
```

### Using Published Images

```bash
# Pull latest
docker pull ghcr.io/<owner>/sports-odds-mcp-backend:latest
docker pull ghcr.io/<owner>/sports-odds-mcp-frontend:latest

# Pull specific version
docker pull ghcr.io/<owner>/sports-odds-mcp-backend:2026.01.12
docker pull ghcr.io/<owner>/sports-odds-mcp-frontend:2026.01.12
```

## Automated Releases (GitHub Actions)

### Trigger Automated Release

```bash
# Create and push a calendar-versioned tag
git tag 2026.01.12
git push origin 2026.01.12
```

GitHub Actions will automatically:
1. Build all components
2. Create distribution ZIPs
3. Build and push multi-architecture Docker images
4. Create GitHub release with all artifacts

### Workflow File

Located at `.github/workflows/release.yml`, the workflow:
- Triggers on calendar-versioned tags (`YYYY.MM.DD` or `YYYY.MM.DD.N`)
- Builds for `linux/amd64` and `linux/arm64`
- Pushes to GitHub Container Registry
- Creates release with MCPB package and ZIPs

## Build Outputs

### Directory Structure

```
mcp/
├── releases/                           # Release artifacts
│   ├── sports-data-mcp-v0.1.14.mcpb   # MCP server package
│   ├── backend.v0.2.3.zip              # Backend distribution
│   └── frontend.v0.2.3.zip             # Frontend distribution
└── scripts/build/
    ├── build.ps1                       # Main build script
    └── docker-build.ps1                # Docker build script

dashboard/
└── dist/                               # Built dashboard
    ├── backend/                        # Compiled Node.js
    └── frontend/                       # Built React app
```

### Artifact Contents

**MCPB Package** (`sports-data-mcp-v*.mcpb`):
- Python MCP server
- API handlers and formatters
- Team reference data
- manifest.json and requirements.txt

**Backend ZIP** (`backend.v*.zip`):
- Compiled TypeScript (dist/)
- package.json with dependencies
- Prisma schema and migrations
- .env.example

**Frontend ZIP** (`frontend.v*.zip`):
- Bundled React app
- Optimized assets (JS, CSS, images)
- index.html

## Version Bumping

### Automatic (Recommended)

Use `-VersionBump` with semantic versioning:

```powershell
# Patch: 0.1.14 → 0.1.15
.\build.ps1 -FullRelease -VersionBump patch

# Minor: 0.1.15 → 0.2.0
.\build.ps1 -FullRelease -VersionBump minor

# Major: 0.2.0 → 1.0.0
.\build.ps1 -FullRelease -VersionBump major
```

### Selective Version Bumps

```powershell
# Bump only MCP
.\build.ps1 -MCP -VersionBump patch -BumpMCP

# Bump only Dashboard components
.\build.ps1 -Dashboard -VersionBump patch -BumpDashboard -BumpBackend -BumpFrontend

# Bump everything
.\build.ps1 -MCP -Dashboard -VersionBump patch -BumpMCP -BumpDashboard -BumpBackend -BumpFrontend
```

## Beta Releases

Beta releases use git commit hashes for version suffixes:

```powershell
# Create beta build
.\build.ps1 -MCP -Beta

# Output: sports-data-mcp-v0.1.14-beta.a8f3c92.mcpb
```

**Note**: Beta releases are local only and not pushed to GitHub.

## Troubleshooting

### Docker Build Fails

1. **Check Docker is running**: `docker --version`
2. **Verify login**: `docker login ghcr.io -u <username>`
3. **Check GITHUB_TOKEN**: `echo $env:GITHUB_TOKEN`
4. **Build single arch first**: Use `-Platform "linux/amd64"` for faster debugging

### GitHub Release Fails

1. **Check GitHub CLI**: `gh --version`
2. **Authenticate**: `gh auth login`
3. **Verify git remote**: `git remote -v`
4. **Check permissions**: Ensure write access to repository

### Version Not Updating

1. **Check JSON syntax**: Verify package.json files are valid
2. **Run with verbose**: Add `-Verbose` to build command
3. **Manual bump**: Edit version in package.json files directly

### Build Artifacts Missing

1. **Clean and rebuild**: `.\build.ps1 -Clean` then rebuild
2. **Check paths**: Ensure in `scripts/` directory
3. **Verify npm/python**: Check dependencies installed

## Best Practices

1. **Test locally before pushing**:
   ```powershell
   # Build without push first
   .\build.ps1 -FullRelease -VersionBump patch
   # Review artifacts in mcp/releases/
   # Then push Docker images
   .\docker-build.ps1 -Version "2026.01.12" -Backend -Frontend -Push
   ```

2. **Use calendar versions for releases**:
   - Makes it easy to identify when a release was made
   - Supports multiple releases per day (`.1`, `.2` suffix)

3. **Keep component versions semantic**:
   - Breaking changes: major bump
   - New features: minor bump
   - Bug fixes: patch bump

4. **Update CHANGELOG.md**:
   - Document changes before release
   - Move [Unreleased] items to versioned section

5. **Test Docker images locally**:
   ```bash
   # After building
   docker run -p 3001:3001 sports-dashboard-backend:2026.01.12
   docker run -p 80:80 sports-dashboard-frontend:2026.01.12
   ```

## GitHub Container Registry Setup

### Make Packages Public (Optional)

1. Go to GitHub repository → Packages
2. Select the package (backend or frontend)
3. Package settings → Change visibility → Public
4. Confirm the change

### Pull Without Authentication (if public)

```bash
# No login required for public packages
docker pull ghcr.io/<owner>/sports-odds-mcp-backend:latest
```

## Docker Configuration & Secrets

The backend Docker image supports multiple configuration methods for secure secret management.

### Option 1: Environment Variables (Development)

```bash
docker run -e DATABASE_URL="postgresql://user:pass@host/db" \
           -e ODDS_API_KEY="your_key" \
           -e SESSION_SECRET="$(openssl rand -hex 32)" \
           ghcr.io/<owner>/sports-odds-mcp-backend:latest
```

### Option 2: .env File (Development)

```bash
docker run -v $(pwd)/.env:/app/.env \
           ghcr.io/<owner>/sports-odds-mcp-backend:latest
```

### Option 3: Docker Secrets (Production - Recommended)

Docker secrets are the most secure way to pass sensitive data:

```bash
# Create secret files
echo -n "your_api_key" > odds_api_key.txt
echo -n "secure_db_password" > db_password.txt

# Run with secrets (Swarm mode)
docker service create \
  --name backend \
  --secret odds_api_key \
  --secret db_password \
  ghcr.io/<owner>/sports-odds-mcp-backend:latest

# Run with secrets (Docker Compose)
docker-compose -f docker-compose.prod.yml up -d
```

### Option 4: Docker Compose with Secrets (Production)

Use the included `dashboard/docker-compose.prod.yml`:

```bash
# Setup secrets directory
mkdir -p dashboard/secrets
echo -n "your_odds_api_key" > dashboard/secrets/odds_api_key.txt
echo -n "$(openssl rand -hex 32)" > dashboard/secrets/session_secret.txt
echo -n "sports_user" > dashboard/secrets/db_user.txt
echo -n "secure_password" > dashboard/secrets/db_password.txt

# Secure the files
chmod 600 dashboard/secrets/*.txt

# Start the stack
cd dashboard
docker-compose -f docker-compose.prod.yml up -d
```

The backend entrypoint automatically:
1. Loads secrets from `/run/secrets/*` (Docker secrets mount location)
2. Converts filenames to uppercase environment variables
3. Falls back to `.env` file if present (secrets take precedence)
4. Runs Prisma migrations if `AUTO_MIGRATE=true`

### Secret Priority

When the same configuration exists in multiple places:
1. **Docker secrets** (highest priority) - Mounted at `/run/secrets/`
2. **Environment variables** - Passed via `-e` or `environment:` in compose
3. **.env file** (lowest priority) - Mounted or copied into container

### External Secret Stores

For production deployments, use managed secret services:

**AWS Secrets Manager**:
```yaml
# docker-compose with AWS secrets plugin
services:
  backend:
    secrets:
      - source: odds_api_key
        target: odds_api_key
secrets:
  odds_api_key:
    external: true
    name: arn:aws:secretsmanager:region:account:secret:name
```

**Azure Key Vault**:
Use Azure Container Instances with managed identities to fetch secrets at runtime.

**Kubernetes**:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: sports-dashboard-secrets
type: Opaque
stringData:
  odds_api_key: your_api_key
  db_password: secure_password
```

See [dashboard/secrets/README.md](../dashboard/secrets/README.md) for complete setup instructions.

## Additional Resources

- [GitHub Container Registry Docs](https://docs.github.com/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Docker Multi-Platform Builds](https://docs.docker.com/build/building/multi-platform/)
- [Docker Secrets](https://docs.docker.com/engine/swarm/secrets/)
- [GitHub Actions Workflows](https://docs.github.com/actions)
- [Semantic Versioning](https://semver.org/)

