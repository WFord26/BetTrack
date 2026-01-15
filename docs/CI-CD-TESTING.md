# CI/CD Testing Quick Reference

## GitHub Actions Workflows

### Test Workflow (`test.yml`)
**Triggers:**
- Pull requests → `main`, `beta`, `develop`
- Pushes → `main`, `beta`

**Jobs:**
1. **Backend Tests** → Jest + PostgreSQL + Coverage
2. **Frontend Tests** → Vitest + Type Check + Coverage
3. **MCP Validation** → Python syntax/lint + Server start test
4. **Build Validation** → Ensures all components build

**Status Checks:**
- All jobs must pass before merge
- Coverage reports posted to PR comments
- Codecov integration (optional)

### Release Workflow (`release.yml`)
**Triggers:**
- Git tags matching `YYYY.MM.DD` or `YYYY.MM.DD.N`

**Flow:**
1. **Test Job** (runs first, blocks release if fails)
   - Backend tests
   - Frontend tests
   - Linting
   - MCP validation
2. **Release Job** (runs only if tests pass)
   - Build MCP package
   - Build dashboard (backend + frontend)
   - Create Docker images
   - Publish GitHub release

## Local Testing Before Push

### Quick Check (2-3 minutes)
```bash
# Backend
cd dashboard/backend && npm test

# Frontend
cd dashboard/frontend && npm test
```

### Full Validation (5-7 minutes)
```bash
# Backend
cd dashboard/backend
npm run lint
npm run test:coverage

# Frontend
cd dashboard/frontend
npm run lint
npx tsc --noEmit
npm run test:coverage

# MCP Server
cd mcp
python -m py_compile sports_mcp_server.py
```

### Build Verification (REQUIRED before release)
```bash
# Use centralized build script
cd scripts
.\build.ps1 -Dashboard -BumpBackend -BumpFrontend

# Verify outputs
ls ../dashboard/dist/backend/
ls ../dashboard/dist/frontend/
```

## PR Checklist

Before creating a pull request:

- [ ] All tests pass locally (`npm test`)
- [ ] Linters pass (`npm run lint`)
- [ ] TypeScript compiles (`npx tsc --noEmit`)
- [ ] Coverage meets thresholds (60%+)
- [ ] Builds complete successfully
- [ ] CHANGELOG.md updated

## Release Checklist

Before tagging a release:

- [ ] All tests pass on `main` branch
- [ ] Build scripts execute successfully
- [ ] Version numbers updated (if applicable)
- [ ] CHANGELOG.md has release notes
- [ ] Docker images build successfully (local test)
- [ ] No failing CI checks

## Debugging Failed CI

### Backend Test Failures
```bash
# Check database connection
# Review test logs in GitHub Actions
# Run tests locally with same Node version (20.x)
cd dashboard/backend
npm ci  # Use exact versions from package-lock.json
npm run test:ci
```

### Frontend Test Failures
```bash
# Check for missing dependencies
# Verify TypeScript compilation
cd dashboard/frontend
npm ci
npx tsc --noEmit
npm run test:ci
```

### Build Failures
```bash
# Clean build locally
cd dashboard/backend
npm run clean
npm run build

cd dashboard/frontend
npm run clean
npm run build
```

### Docker Build Failures
```bash
# Test Docker builds locally
cd dashboard/backend
docker build -f Dockerfile -t test-backend .

cd dashboard/frontend
docker build -f Dockerfile -t test-frontend .
```

## Coverage Requirements

### Minimum Thresholds (60%)
- Lines: 60%
- Functions: 60%
- Branches: 60%
- Statements: 60%

### Viewing Coverage Locally
```bash
# Backend
cd dashboard/backend
npm run test:coverage
open coverage/index.html

# Frontend
cd dashboard/frontend
npm run test:coverage
open coverage/index.html
```

## Environment Variables for CI

### Backend Tests
- `DATABASE_URL`: PostgreSQL connection string
- `NODE_ENV`: `test`
- `ODDS_API_KEY`: Test API key
- `JWT_SECRET`: Test secret
- `SESSION_SECRET`: Test secret

### Frontend Tests
- `VITE_API_BASE_URL`: Mocked in test setup

### MCP Server
- `ODDS_API_KEY`: Test API key

## Common CI Errors

### "Cannot find module"
**Cause**: Missing dependency or incorrect import
**Fix**: Run `npm ci` locally, check import paths

### "Database connection failed"
**Cause**: PostgreSQL service not ready
**Fix**: Check service health checks in workflow

### "Coverage threshold not met"
**Cause**: New code lacks tests
**Fix**: Add tests for new features/functions

### "Build failed"
**Cause**: TypeScript errors or missing files
**Fix**: Run `npm run build` locally, fix errors

### "Linting errors"
**Cause**: Code style violations
**Fix**: Run `npm run lint:fix` locally

## Manual Workflow Triggers

GitHub Actions can be manually triggered for testing:

1. Go to **Actions** tab in GitHub
2. Select workflow (`Test & Validate` or `Release Build`)
3. Click **Run workflow** button
4. Select branch
5. Click **Run workflow**

## Status Badge

Add to README.md:
```markdown
![Tests](https://github.com/YOUR_USERNAME/BetTrack/workflows/Test%20%26%20Validate/badge.svg)
```

## Notifications

Configure GitHub notifications for:
- Failed CI checks on your commits
- PR review requests
- Failed deployments

Settings → Notifications → Actions

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Jest CI Configuration](https://jestjs.io/docs/configuration#ci-boolean)
- [Vitest CI Documentation](https://vitest.dev/guide/cli.html#ci)
- [Codecov Documentation](https://docs.codecov.com/docs)
