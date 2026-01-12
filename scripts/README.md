# Build Scripts Documentation

## Overview

The `build.ps1` PowerShell script provides comprehensive build automation for both the MCP server and web dashboard components of Sports-Odds-MCP.

## Prerequisites

### For MCP Builds
- **Python 3.11+**: Required for MCP server
- **pip**: Python package manager
- **Git**: For version tagging and releases
- **GitHub CLI** (optional): For automated GitHub releases

### For Dashboard Builds
- **Node.js 20+**: Required for dashboard
- **npm 10+**: Package manager (comes with Node.js)

## Usage

### Basic Commands

```powershell
# Build MCP package with patch version bump
.\build.ps1 -MCP -VersionBump patch

# Build dashboard only
.\build.ps1 -Dashboard

# Build both MCP and dashboard
.\build.ps1 -MCP -Dashboard -VersionBump minor

# Clean build artifacts
.\build.ps1 -Clean

# Clean specific components
.\build.ps1 -Clean -MCP          # Clean only MCP artifacts
.\build.ps1 -Clean -Dashboard    # Clean only dashboard artifacts
```

### Version Management

```powershell
# Patch version bump (0.1.12 → 0.1.13)
.\build.ps1 -MCP -VersionBump patch

# Minor version bump (0.1.12 → 0.2.0)
.\build.ps1 -MCP -VersionBump minor

# Major version bump (0.1.12 → 1.0.0)
.\build.ps1 -MCP -VersionBump major
```

### Beta Builds

```powershell
# Beta with git hash (e.g., v0.1.13-beta.928845c)
.\build.ps1 -MCP -Beta

# Beta with version bump (e.g., v0.1.14-beta.1)
.\build.ps1 -MCP -VersionBump patch -Beta

# Subsequent beta builds increment: v0.1.14-beta.2, v0.1.14-beta.3, etc.
.\build.ps1 -MCP -Beta
```

### Releases

```powershell
# Build and create GitHub release
.\build.ps1 -MCP -VersionBump minor -Release

# Beta releases are NOT pushed to GitHub (local testing only)
.\build.ps1 -MCP -VersionBump patch -Beta
# Output: "Beta releases are not pushed to GitHub"
```

## Build Targets

### MCP Server (`-MCP`)

**What it builds:**
- MCPB package (ZIP archive with `.mcpb` extension)
- Includes: server script, API handlers, formatters, manifest, requirements

**Output location:**
- `src/releases/sports-data-mcp-v{version}.mcpb`

**What's included in MCPB:**
- `sports_mcp_server.py` - Main server entry point
- `manifest.json` - MCP server metadata
- `requirements.txt` - Python dependencies
- `mcpb_bootstrap.py` - Bootstrap loader
- `setup.py` - Installation script
- `LICENSE` - Project license
- `.env.example` - Configuration template
- `INSTALL_INSTRUCTIONS.md` - User setup guide
- `sports_api/` - API handlers and utilities

**What's excluded:**
- `.env` file (prevents overwriting user's API keys on updates)
- `__pycache__/` directories
- `.pyc` compiled files
- Test files

**Version management:**
- Updates `manifest.json` version
- Updates `package.json` version
- Creates git tag (if `-Release` specified)

### Dashboard (`-Dashboard`)

**What it builds:**
- Compiled TypeScript backend (Node.js + Express)
- Production React frontend (Vite build)
- Unified deployment package

**Output location:**
- `dashboard/dist/` - Complete deployment package

**Directory structure:**
```
dashboard/dist/
├── backend/
│   ├── dist/          # Compiled TypeScript
│   ├── prisma/        # Database schema
│   ├── package.json   # Backend dependencies
│   └── .env.example   # Backend config template
├── frontend/
│   ├── index.html     # SPA entry point
│   ├── assets/        # Compiled JS/CSS
│   └── ...
├── package.json       # Root workspace config
├── README.md          # Dashboard documentation
└── DEPLOYMENT.md      # Deployment guide
```

**Build process:**
1. Check Node.js version (requires 20+)
2. Install dependencies (if `node_modules/` missing)
3. Build backend with TypeScript compiler
4. Build frontend with Vite (production optimization)
5. Copy builds to unified `dist/` directory
6. Copy deployment files (package.json, Prisma schema, README, etc.)

**Dependencies installed automatically:**
- Backend: Express, Prisma, TypeScript, etc.
- Frontend: React, Redux Toolkit, Tailwind CSS, Vite

## Parameters Reference

### `-VersionBump <major|minor|patch>`
Increment version number:
- `major`: 0.1.12 → 1.0.0 (breaking changes)
- `minor`: 0.1.12 → 0.2.0 (new features)
- `patch`: 0.1.12 → 0.1.13 (bug fixes)

**Affects:**
- `manifest.json` version field
- `package.json` version field
- Git tag (if `-Release` used)

**Notes:**
- Only applies to MCP builds (dashboard has separate versioning)
- Beta builds can bump version or use git hash

### `-MCP`
Build the MCP server package (MCPB format).

**Requires:**
- Python 3.11+ installed
- Valid `requirements.txt` in `src/`

**Creates:**
- `.mcpb` package in `src/releases/`
- Installs Python dependencies during build

### `-Dashboard`
Build the web dashboard (React + Node.js).

**Requires:**
- Node.js 20+ installed
- Valid `package.json` in `dashboard/`, `dashboard/backend/`, `dashboard/frontend/`

**Creates:**
- Compiled backend in `dashboard/dist/backend/`
- Compiled frontend in `dashboard/dist/frontend/`
- Deployment-ready package

### `-Beta`
Create beta version for testing.

**Two modes:**
1. **With `-VersionBump`**: Incremental beta numbering
   - First beta: `v0.1.13-beta.1`
   - Next beta: `v0.1.13-beta.2`
   - Continues incrementing: `v0.1.13-beta.3`, etc.

2. **Without `-VersionBump`**: Git hash suffix
   - Uses short commit hash: `v0.1.12-beta.928845c`
   - Fallback to timestamp if git unavailable

**Behavior:**
- Updates manifest with base version (strips beta suffix)
- Beta releases NOT pushed to GitHub
- Used for local testing before stable release

### `-Release`
Create GitHub release after successful build.

**Requirements:**
- Git repository initialized
- Changes committed
- GitHub CLI (`gh`) installed (optional but recommended)

**Process:**
1. Commits `manifest.json` and `package.json` changes
2. Creates git tag: `v{version}`
3. Pushes to `origin main`
4. Pushes tag to remote
5. Creates GitHub release (if `gh` available)

**Notes:**
- Only works with MCP builds (not dashboard)
- Ignored for beta builds
- Requires `-VersionBump` parameter

### `-Clean`
Remove build artifacts before building.

**What it cleans:**

**MCP artifacts:**
- `src/build/` directory
- `src/dist/` directory
- `__pycache__/` directories
- `.pyc` compiled Python files

**Dashboard artifacts:**
- `dashboard/dist/` directory
- `dashboard/backend/dist/` directory
- `dashboard/frontend/dist/` directory

**Targeted cleaning:**
```powershell
# Clean only MCP
.\build.ps1 -Clean -MCP

# Clean only Dashboard  
.\build.ps1 -Clean -Dashboard

# Clean both
.\build.ps1 -Clean
```

## Examples

### Development Workflow

```powershell
# 1. Make changes to MCP server
# 2. Test locally with Claude Desktop
# 3. Build beta for validation
.\build.ps1 -MCP -Beta

# 4. Test beta installation
# 5. If good, build stable version
.\build.ps1 -MCP -VersionBump patch

# 6. Create release
.\build.ps1 -MCP -VersionBump patch -Release
```

### Dashboard Development

```powershell
# 1. Develop dashboard features
cd dashboard
npm run dev  # Start dev servers

# 2. Test locally
# 3. Build for production
cd ..
.\src\scripts\build\build.ps1 -Dashboard

# 4. Deploy dist/ to server
# See DEPLOYMENT.md for deployment steps
```

### Combined Release

```powershell
# Build both MCP and dashboard with version bump
.\build.ps1 -MCP -Dashboard -VersionBump minor

# Clean everything and rebuild
.\build.ps1 -Clean
.\build.ps1 -MCP -Dashboard -VersionBump patch
```

## Output Messages

### Success Indicators
- `[OK]` - Operation completed successfully
- `[INFO]` - Informational message
- Green text - Success state

### Warning Indicators
- `[WARN]` - Non-critical issue
- Yellow text - Warning state

### Error Indicators
- `[ERROR]` - Critical failure
- Red text - Error state

## Troubleshooting

### MCP Build Issues

**"manifest.json not found"**
- Ensure you're running script from correct directory
- Script expects: `src/scripts/build/build.ps1`

**"Failed to install dependencies"**
- Check Python version: `python --version` (requires 3.11+)
- Verify pip installed: `pip --version`
- Try manual install: `pip install -r requirements.txt`

**"Not a git repository"**
- Only affects `-Release` flag
- Initialize git: `git init`
- Or skip release: omit `-Release` flag

### Dashboard Build Issues

**"Node.js not found"**
- Install Node.js 20+ from https://nodejs.org/
- Verify installation: `node --version`

**"Backend build failed"**
- Check TypeScript errors in `dashboard/backend/src/`
- Run manually: `cd dashboard && npm run build:backend`
- Check `tsconfig.json` configuration

**"Frontend build failed"**
- Check React/Vite errors in `dashboard/frontend/src/`
- Run manually: `cd dashboard && npm run build:frontend`
- Check `vite.config.ts` configuration

**"npm install failed"**
- Delete `node_modules/` and try again
- Clear npm cache: `npm cache clean --force`
- Check internet connection (downloads packages)

### General Issues

**"No build target specified"**
- Must include `-MCP` or `-Dashboard` flag
- Example: `.\build.ps1 -MCP -VersionBump patch`

**Script execution disabled**
- Enable PowerShell scripts: `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`
- Or run with bypass: `powershell -ExecutionPolicy Bypass -File .\build.ps1 -MCP`

## File Locations

### Source Files
- **MCP Server**: `src/sports_mcp_server.py`
- **Dashboard Backend**: `dashboard/backend/src/`
- **Dashboard Frontend**: `dashboard/frontend/src/`

### Configuration
- **MCP Manifest**: `src/manifest.json`
- **MCP Package**: `src/package.json`
- **Dashboard Root**: `dashboard/package.json`
- **Backend Config**: `dashboard/backend/package.json`
- **Frontend Config**: `dashboard/frontend/package.json`

### Build Outputs
- **MCP Packages**: `src/releases/*.mcpb`
- **MCP Build Temp**: `src/build/`
- **Dashboard Build**: `dashboard/dist/`

## Best Practices

1. **Always test beta builds** before stable releases
2. **Clean before major releases** to ensure fresh build
3. **Commit changes before `-Release`** flag
4. **Use semantic versioning**:
   - Patch: Bug fixes only
   - Minor: New features, backward compatible
   - Major: Breaking changes
5. **Document changes in CHANGELOG.md** before release
6. **Test dashboard builds locally** before deploying

## Integration with CI/CD

The build script can be integrated into automated workflows:

```yaml
# Example GitHub Actions workflow
- name: Build MCP Package
  run: |
    cd src/scripts/build
    .\build.ps1 -MCP -VersionBump ${{ github.event.inputs.version }} -Release

- name: Build Dashboard
  run: |
    cd src/scripts/build
    .\build.ps1 -Dashboard
```

## Version History

See `CHANGELOG.md` for full version history and release notes.

## Support

For issues with the build script:
1. Check this documentation
2. Review error messages carefully
3. Check PowerShell version: `$PSVersionTable`
4. Verify prerequisites installed
5. Open GitHub issue with full error output

## Related Documentation

- **CHANGELOG.md**: Version history and release notes
- **DEPLOYMENT.md**: Dashboard deployment guide (in `dashboard/`)
- **README.md**: Project overview and usage
- **docs/AVAILABLE-TOOLS.md**: MCP tool reference
