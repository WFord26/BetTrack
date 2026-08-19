# Contributing to BetTrack

## Overview

Thank you for contributing to BetTrack! This document provides guidelines for contributing to the project.

## Development Setup

See the main [README.md](README.md) for project structure and setup instructions.

## Testing

### Coverage Requirements

Coverage thresholds are enforced in CI and increase over time:

- **Backend** (`dashboard/backend/jest.config.js`): Thresholds increase by 2 points per release
- **Frontend** (`dashboard/frontend/vite.config.ts`): Thresholds increase by 2 points per release

**Key principle: Coverage thresholds only go up.** They are ratcheted after each release to prevent regression. When coverage improves, thresholds are raised to maintain that improvement.

Run tests locally before submitting PRs:

```bash
# Backend
cd dashboard/backend
npm test                # Run tests
npm run test:coverage   # View coverage report

# Frontend
cd dashboard/frontend
npm test                # Run tests
npm run test:coverage   # View coverage report
```

## Building

Before pushing changes, verify all builds succeed:

```bash
cd scripts

# Build MCP server
.\build.ps1 -MCP -VersionBump patch -BumpMCP

# Build Dashboard
.\build.ps1 -Dashboard -BumpBackend -BumpFrontend

# Build everything
.\build.ps1 -MCP -Dashboard -VersionBump patch -BumpMCP -BumpBackend -BumpFrontend
```

## Submitting Pull Requests

`main` is protected — it only moves through a pull request with CI green. See
[BRANCH-PROTECTION.md](docs/BRANCH-PROTECTION.md) for the exact rules.

1. Create a feature branch from `main` or `dev`
2. Make your changes and commit with clear messages
3. Run tests and build verification locally
4. Ensure coverage does not decrease
5. Submit a PR with a clear description
6. Address review feedback promptly

Install the local hooks once per clone so a stray push to `main` fails fast:

```bash
./scripts/install-git-hooks.sh
```

## Code Quality

- Use TypeScript for backend and frontend code
- Use Python 3.11+ for MCP server code
- Follow existing code style (ESLint/Prettier for TS, Black/Pylint for Python)
- Add tests for new functionality

## Questions?

Open an issue or discussion for questions. See [PROJECT.md](docs/PROJECT.md) for more detailed documentation.
