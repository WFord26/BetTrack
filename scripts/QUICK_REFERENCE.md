# Build Script Quick Reference

## Common Commands

```powershell
# MCP Only
.\build.ps1 -MCP -VersionBump patch              # Patch release
.\build.ps1 -MCP -VersionBump minor              # Minor release
.\build.ps1 -MCP -VersionBump major              # Major release
.\build.ps1 -MCP -Beta                           # Beta with git hash
.\build.ps1 -MCP -VersionBump patch -Beta        # Beta with version bump
.\build.ps1 -MCP -VersionBump minor -Release     # Release to GitHub

# Dashboard Only
.\build.ps1 -Dashboard                           # Build dashboard
.\build.ps1 -Dashboard -Clean                    # Clean then build

# Both Targets
.\build.ps1 -MCP -Dashboard -VersionBump patch   # Build both
.\build.ps1 -Clean                               # Clean everything
```

## Build Targets

| Flag | Builds | Output |
|------|--------|--------|
| `-MCP` | MCPB package | `src/releases/*.mcpb` |
| `-Dashboard` | React + Node.js | `dashboard/dist/` |
| Both | MCP + Dashboard | Both outputs |
| None | Error message | N/A |

## Version Bumping

| Type | Example | Use Case |
|------|---------|----------|
| `patch` | 0.1.12 → 0.1.13 | Bug fixes |
| `minor` | 0.1.12 → 0.2.0 | New features |
| `major` | 0.1.12 → 1.0.0 | Breaking changes |

## Beta Versions

| Command | Version Format | GitHub Release |
|---------|---------------|----------------|
| `-Beta` (no bump) | v0.1.12-beta.928845c | No |
| `-Beta` (with bump) | v0.1.13-beta.1 | No |
| Subsequent betas | v0.1.13-beta.2, .3, etc. | No |

## Flags Reference

| Flag | Required | Description |
|------|----------|-------------|
| `-MCP` | One of MCP/Dashboard | Build MCP server |
| `-Dashboard` | One of MCP/Dashboard | Build dashboard |
| `-VersionBump <type>` | For MCP | Bump version (major/minor/patch) |
| `-Beta` | Optional | Create beta version |
| `-Release` | Optional | Push to GitHub (MCP only) |
| `-Clean` | Optional | Clean before build |

## Prerequisites

**MCP builds require:**
- Python 3.11+
- pip

**Dashboard builds require:**
- Node.js 20+
- npm 10+

**GitHub releases require:**
- Git
- GitHub CLI (optional)

## Typical Workflows

### Development Cycle
```powershell
# 1. Make changes
# 2. Test locally
# 3. Build beta
.\build.ps1 -MCP -Beta

# 4. Test beta
# 5. Create stable release
.\build.ps1 -MCP -VersionBump patch -Release
```

### Dashboard Deployment
```powershell
# 1. Develop features (npm run dev)
# 2. Build for production
.\build.ps1 -Dashboard

# 3. Deploy dist/ folder
# See dashboard/DEPLOYMENT.md
```

### Full Release
```powershell
# Clean, build both, version bump, and release
.\build.ps1 -Clean
.\build.ps1 -MCP -Dashboard -VersionBump minor -Release
```

## Output Locations

| Component | Build Output |
|-----------|--------------|
| MCP Package | `src/releases/sports-data-mcp-v{version}.mcpb` |
| Dashboard | `dashboard/dist/` |
| MCP Temp | `src/build/` (deleted after) |

## Troubleshooting

| Error | Solution |
|-------|----------|
| "No build target specified" | Add `-MCP` or `-Dashboard` |
| "manifest.json not found" | Run from `src/scripts/build/` |
| "Node.js not found" | Install Node.js 20+ |
| "Failed to install dependencies" | Check Python/pip version |
| Script won't run | `Set-ExecutionPolicy RemoteSigned` |

## Examples

```powershell
# Quick MCP patch
.\build.ps1 -MCP -VersionBump patch

# Full release workflow
.\build.ps1 -Clean
.\build.ps1 -MCP -Dashboard -VersionBump minor
.\build.ps1 -MCP -VersionBump minor -Release

# Beta testing
.\build.ps1 -MCP -Beta
# Test...
.\build.ps1 -MCP -Beta  # Creates beta.2, beta.3, etc.

# Dashboard only
.\build.ps1 -Dashboard

# Clean specific target
.\build.ps1 -Clean -MCP      # Clean MCP only
.\build.ps1 -Clean -Dashboard # Clean Dashboard only
```
