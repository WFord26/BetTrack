# NPM Publishing Guide

This guide covers publishing the BetTrack dashboard components to GitHub Packages.

## Packages

- **Backend**: `@wford26/bettrack-backend`
- **Frontend**: `@wford26/bettrack-frontend`

Both packages are published to GitHub Packages under the `@wford26` scope.

## Prerequisites

### 1. GitHub Personal Access Token (PAT)

Create a PAT with `write:packages` permission:
1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Select scopes: `write:packages`, `read:packages`
4. Copy the token

### 2. Authenticate with GitHub Packages

Create or update `~/.npmrc` (your home directory):

```ini
@wford26:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_PAT
```

Or login via npm:
```bash
npm login --scope=@wford26 --auth-type=legacy --registry=https://npm.pkg.github.com
```

## Publishing Methods

### Method 1: Automated (Recommended)

Packages are **automatically published** when you create a GitHub release:

```bash
# Create a release via GitHub CLI
gh release create dashboard-v0.2.0 --title "Dashboard v0.2.0" --notes "Release notes"

# Or use GitHub web UI to create a release
```

The GitHub Actions workflow (`.github/workflows/npm-publish-dashboard.yml`) will:
- Build both packages
- Run tests
- Publish to GitHub Packages

### Method 2: Manual Workflow Trigger

Trigger publishing manually via GitHub Actions:

1. Go to Actions → "Publish Dashboard Packages"
2. Click "Run workflow"
3. Select package: `both`, `backend`, or `frontend`

### Method 3: Manual Publishing

#### Backend
```bash
cd dashboard/backend

# Build
npm run build

# Test (optional)
npm test

# Publish
npm publish
```

#### Frontend
```bash
cd dashboard/frontend

# Build
npm run build

# Test (optional)
npm test

# Publish
npm publish
```

## Version Management

Update versions before publishing:

### Backend
```bash
cd dashboard/backend
npm version patch  # or minor, major
```

### Frontend
```bash
cd dashboard/frontend
npm version patch  # or minor, major
```

### Synchronized versioning (recommended)
Use the build script to bump versions together:
```bash
cd scripts
.\build.ps1 -Dashboard -BumpBackend -BumpFrontend
```

## Installing Published Packages

### Backend
```bash
npm install @wford26/bettrack-backend
```

### Frontend
```bash
npm install @wford26/bettrack-frontend
```

Users must authenticate with GitHub Packages first (see Prerequisites).

## Package Contents

### Backend Package Includes:
- `dist/` - Compiled TypeScript
- `prisma/schema.prisma` - Database schema
- `README.md`, `CHANGELOG.md`

### Frontend Package Includes:
- `dist/` - Vite production build
- `src/` - Source files (for source maps)
- Config files (vite, tailwind, tsconfig)
- `README.md`, `CHANGELOG.md`

## Verifying Package Contents

Before publishing, check what will be included:

```bash
# Backend
cd dashboard/backend
npm pack --dry-run

# Frontend
cd dashboard/frontend
npm pack --dry-run
```

## Troubleshooting

### Authentication Failed
- Ensure your GitHub PAT has `write:packages` permission
- Check `~/.npmrc` has correct token
- Verify scope matches: `@wford26`

### Package Not Found After Publishing
- Check GitHub repo → Packages tab
- Verify package visibility (should be public)
- Ensure registry URL is correct: `https://npm.pkg.github.com`

### Build Failures
- Run `npm ci` to ensure clean dependencies
- Check TypeScript errors: `npm run build`
- Verify all required files are present (not ignored by `.npmignore`)

### Prisma Issues (Backend)
- Ensure Prisma is generated before publishing: `npm run prisma:generate`
- `@prisma/client` must be in dependencies (not devDependencies)

## GitHub Actions Workflow

The workflow (`.github/workflows/npm-publish-dashboard.yml`) triggers on:
- **Releases**: Automatically publishes when a release is created
- **Manual**: Workflow dispatch with package selection

Workflow features:
- Builds before publishing
- Runs tests (non-blocking)
- Uses `GITHUB_TOKEN` (no manual setup needed)
- Publishes to GitHub Packages
- Separate jobs for backend/frontend

## Best Practices

1. **Always version bump** before publishing
2. **Test builds locally** before releasing
3. **Update CHANGELOGs** with release notes
4. **Use semantic versioning**: MAJOR.MINOR.PATCH
5. **Create GitHub releases** for automated publishing
6. **Check package contents** with `npm pack --dry-run`
7. **Tag releases** with meaningful names (e.g., `dashboard-v0.2.0`)

## Public vs Private Packages

Current configuration: **Public packages** on GitHub Packages

To make packages private:
1. Update `publishConfig.access` to `"restricted"` in package.json
2. Update GitHub package visibility in repository settings

## Registry Migration (Optional)

To publish to public NPM instead of GitHub Packages:

1. Remove `.npmrc` file
2. Update `publishConfig` in both package.json:
   ```json
   "publishConfig": {
     "access": "public"
   }
   ```
3. Remove `registry` field
4. Create NPM account and authenticate: `npm login`
5. Update workflow to use `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`

## Links

- [GitHub Packages Documentation](https://docs.github.com/en/packages)
- [npm CLI Documentation](https://docs.npmjs.com/cli)
- [Semantic Versioning](https://semver.org/)
