# Bump Script Quick Reference

## Quick Start

From the `dashboard/` directory:

```bash
# Auto-detect changes and bump
npm run bump

# Force bump specific type
npm run bump:patch
npm run bump:minor
npm run bump:major

# Preview changes
npm run bump -- --dry-run

# Help
npm run bump -- --help
```

## What It Does

1. **Detects Changes** - Hashes files in `mcp/`, `dashboard/backend/`, `dashboard/frontend/`
2. **Bumps Versions** - Updates `package.json` for changed packages using semantic versioning
3. **Updates Dependencies** - Automatically updates internal package references
4. **Tracks State** - Stores file hashes in `.bump-hashes.json`

## Workflow

```bash
# 1. Make changes to code
git add .
git commit -m "feat: add new feature"

# 2. Bump versions
cd dashboard
npm run bump

# 3. Review changes
git diff

# 4. Commit version bump
git add .bump-hashes.json mcp/package.json dashboard/*/package.json
git commit -m "chore: bump versions"

# 5. Push
git push origin
```

## Examples

### Auto-detect MCP server changes
```bash
npm run bump
# Detects changes in mcp/ → bumps mcp to 0.2.4
```

### Force minor bump on frontend
```bash
npm run bump:minor
# All packages bumped by minor version (no detection)
```

### Preview without modifying files
```bash
npm run bump -- --dry-run
# Shows what would happen
```

### Help
```bash
npm run bump -- --help
# Full usage documentation
```

## Semantic Versioning

- **PATCH** (0.0.1) - Bug fixes, refactoring
- **MINOR** (0.1.0) - New features (backward compatible)
- **MAJOR** (1.0.0) - Breaking changes

Default is PATCH when changes detected. Use `--force minor|major` for explicit control.

## Tracked Packages

| Package | Location | Current Version |
|---------|----------|-----------------|
| MCP Server | `mcp/package.json` | 0.2.3 |
| Backend | `dashboard/backend/package.json` | 0.2.6 |
| Frontend | `dashboard/frontend/package.json` | 0.3.6 |

## Ignored Files

- `package.json` and `package-lock.json`
- `*.tsbuildinfo`
- `/dist/`, `/node_modules/`, `/coverage/`
- `/__pycache__/`, `.pytest_cache/`

## Files Modified

Each bump run updates:
- `.bump-hashes.json` - File snapshots
- `mcp/package.json` - If MCP changed
- `dashboard/backend/package.json` - If backend changed
- `dashboard/frontend/package.json` - If frontend changed

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "No changes detected" | Use `--force` flag to bump anyway |
| Always bumping | Check if untracked files are changing |
| Wrong version format | Ensure versions are semantic: `X.Y.Z` |

## See Also

- **Full Documentation**: [scripts/BUMP-SYSTEM.md](./BUMP-SYSTEM.md)
- **Build Script**: [mcp/scripts/build.ps1](./build.ps1)
- **Project Structure**: [../README.md](../README.md)
