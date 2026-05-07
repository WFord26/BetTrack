# BetTrack Version Bump System

A script-based versioning system that automatically detects changes and bumps semantic versions for BetTrack's components.

## Components Tracked

The bump system manages versions for three independent packages:

1. **MCP Server** (`mcp/`)
   - Location: `mcp/package.json`
   - Current version: `0.2.1`
   - Scope: Sports API handlers, formatters, server code

2. **Dashboard Backend** (`dashboard/backend/`)
   - Location: `dashboard/backend/package.json`
   - Current version: `0.2.4`
   - Scope: Express API, Prisma ORM, services, database

3. **Dashboard Frontend** (`dashboard/frontend/`)
   - Location: `dashboard/frontend/package.json`
   - Current version: `0.3.4`
   - Scope: React components, Redux store, UI

## How It Works

The bump system uses **file hashing** to detect changes:

1. **Snapshots** - Creates SHA256 hashes of all tracked files for each package
2. **Storage** - Stores snapshots in `.bump-hashes.json` at the root
3. **Detection** - Compares new snapshots to stored snapshots to find changes
4. **Versioning** - Auto-bumps semantic versions (`major.minor.patch`) for changed packages
5. **Dependencies** - Updates internal dependencies when referenced packages are bumped

## Usage

### From Dashboard Directory

```bash
cd dashboard

# Auto-detect changes and bump changed packages
npm run bump

# Force bump with specific type
npm run bump:patch
npm run bump:minor
npm run bump:major

# Preview changes (dry-run)
npm run bump -- --dry-run

# Bump only since a git ref
npm run bump -- --since origin/main
```

### From Root Directory

If you create a root `package.json`, you can run:

```bash
npm run bump
npm run bump:patch
npm run bump:minor
npm run bump:major
```

## Examples

### Example 1: Auto-detect MCP server changes

```bash
cd dashboard
npm run bump

# Output:
# 📦 Loading package manifests...
# ✅ Loaded 3 packages
#    - mcp: sports-data-mcp (0.2.1)
#    - dashboard/backend: @wford26/bettrack-backend (0.2.4)
#    - dashboard/frontend: @wford26/bettrack-frontend (0.3.4)
#
# 🔍 Computing package snapshots...
#
# 📝 Changed packages:
#    - mcp
#
# 🚀 Bumping with type: patch
#    mcp: 0.2.1 → 0.2.2
#
# ✅ Updated .bump-hashes.json
# ✅ Updated package.json versions
#
# 💡 Tip: Run 'git diff' to review changes before committing.
```

### Example 2: Force minor bump on frontend

```bash
npm run bump:minor

# All unchanged packages skip the bump. Only outputs:
# 🚀 Bumping with type: minor
#    dashboard/frontend: 0.3.4 → 0.4.0
```

### Example 3: Dry-run preview

```bash
npm run bump -- --dry-run

# Shows what *would* change without writing files
```

## Configuration

### Tracked Directories

Edit `scripts/bump-version.mjs` to modify which files are tracked:

```javascript
const PACKAGE_CONFIGS = [
  {
    key: "mcp",
    manifestPath: "mcp/package.json",
    trackedDirs: ["mcp"],  // ← Change this
  },
  // ...
];
```

### Ignored Paths

Files matching these patterns are always ignored:

- `*.tsbuildinfo`
- `/dist/` directories
- `/node_modules/` directories
- `/coverage/` directories
- `/__pycache__/` directories
- `.pytest_cache/`

## Workflow

### 1. Develop & Commit

Make changes to any package (MCP, backend, frontend):

```bash
git add .
git commit -m "feat: add new feature"
```

### 2. Bump Versions

Auto-detect and bump:

```bash
cd dashboard
npm run bump
```

### 3. Review & Verify

Check the changes:

```bash
git diff
git diff mcp/package.json
git diff dashboard/backend/package.json
git diff dashboard/frontend/package.json
```

### 4. Commit Version Bump

```bash
git add .bump-hashes.json mcp/package.json dashboard/*/package.json
git commit -m "chore: bump versions"
```

### 5. Create Release Tag

```bash
git tag v0.2.2-dashboard-0.2.4-frontend-0.3.5
git push origin --tags
```

## What Gets Updated

When you run `npm run bump`, these files are modified:

- `.bump-hashes.json` - Latest file hashes and package snapshots
- `mcp/package.json` - If MCP files changed
- `dashboard/backend/package.json` - If backend files changed
- `dashboard/frontend/package.json` - If frontend files changed

## Internal Dependencies

If Dashboard Frontend depends on Dashboard Backend, bumping the backend **automatically updates frontend's dependency version**:

```json
// Before bump
{
  "dependencies": {
    "@wford26/bettrack-backend": "^0.2.4"
  }
}

// After backend bumps to 0.2.5
{
  "dependencies": {
    "@wford26/bettrack-backend": "^0.2.5"
  }
}
```

## When to Use Each Flag

| Scenario | Command |
|----------|---------|
| Normal workflow (auto-detect) | `npm run bump` |
| Need exact control | `npm run bump:patch\|minor\|major` |
| Multiple changes same day | `npm run bump` (auto-increments) |
| Reviewing before commit | `npm run bump -- --dry-run` |
| Since specific commit | `npm run bump -- --since origin/main` |
| Get help | `npm run bump -- --help` |

## Troubleshooting

### "No changes detected. Run with --force to bump anyway."

All files match previous snapshots. Use `--force` if you need to bump anyway:

```bash
npm run bump -- --force patch
```

### "must use semantic versioning"

A `package.json` has an invalid version. Fix it to be `major.minor.patch`:

```json
// ❌ Wrong
"version": "1.2"

// ✅ Correct
"version": "1.2.0"
```

### Hashes don't match expectations

The `.bump-hashes.json` file may be out of sync. Regenerate:

```bash
npm run bump -- --dry-run
rm .bump-hashes.json
npm run bump
```

## Integration with CI/CD

For automated releases, add to GitHub Actions:

```yaml
- name: Bump versions
  run: |
    cd dashboard
    npm run bump
    
- name: Commit version bump
  run: |
    git config user.email "bot@example.com"
    git config user.name "Version Bot"
    git add .bump-hashes.json mcp/package.json dashboard/*/package.json
    git commit -m "chore: bump versions" || true
    git push
```

## File Format: .bump-hashes.json

```json
{
  "schemaVersion": 1,
  "packages": {
    "mcp": {
      "name": "sports-data-mcp",
      "hash": "abc123def456...",
      "files": {
        "mcp/package.json": "file_hash_1",
        "mcp/sports_mcp_server.py": "file_hash_2",
        "..."  : "..."
      }
    },
    "dashboard/backend": { /* ... */ },
    "dashboard/frontend": { /* ... */ }
  }
}
```

The `hash` field is computed from all `files` hashes. If any file changes, both that file's hash and the package's overall hash change, triggering a version bump.

## Best Practices

✅ **Do:**
- Run bump after finalizing features
- Review `git diff` before committing version bumps
- Use meaningful git messages for version commits
- Tag releases with clear version identifiers
- Run `npm run bump -- --dry-run` first if unsure

❌ **Don't:**
- Manually edit `.bump-hashes.json` (let the script manage it)
- Manually increment versions - let auto-detection handle it
- Commit version bumps in the same commit as code changes
- Force bump without good reason (trust the auto-detection)

## Semantic Versioning Guide

For your components, use this for choosing bump types:

- **MAJOR** (1.0.0 → 2.0.0): Breaking changes, incompatible API changes
- **MINOR** (1.2.0 → 1.3.0): New features, backward compatible
- **PATCH** (1.2.3 → 1.2.4): Bug fixes, refactoring, documentation

Since this system auto-detects on ANY change, defaults to PATCH. Use `--force minor` or `--force major` when you know the nature of your changes.
