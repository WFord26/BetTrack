# GitHub Actions Status Badges

Add these badges to your README.md files to display build and test status:

## Main README (`README.md`)

```markdown
## Build Status

[![Test & Validate](https://github.com/YOUR_USERNAME/Sports-Odds-MCP/workflows/Test%20%26%20Validate/badge.svg)](https://github.com/YOUR_USERNAME/Sports-Odds-MCP/actions/workflows/test.yml)
[![Release Build](https://github.com/YOUR_USERNAME/Sports-Odds-MCP/workflows/Release%20Build/badge.svg)](https://github.com/YOUR_USERNAME/Sports-Odds-MCP/actions/workflows/release.yml)
[![codecov](https://codecov.io/gh/YOUR_USERNAME/Sports-Odds-MCP/branch/main/graph/badge.svg)](https://codecov.io/gh/YOUR_USERNAME/Sports-Odds-MCP)
```

## Dashboard README (`dashboard/README.md`)

```markdown
## Dashboard Status

[![Backend Tests](https://github.com/YOUR_USERNAME/BetTrack/workflows/Test%20%26%20Validate/badge.svg?job=backend-tests)](https://github.com/YOUR_USERNAME/BetTrack/actions/workflows/test.yml)
[![Frontend Tests](https://github.com/YOUR_USERNAME/BetTrack/workflows/Test%20%26%20Validate/badge.svg?job=frontend-tests)](https://github.com/YOUR_USERNAME/BetTrack/actions/workflows/test.yml)
```

## Badge Meanings

### Test & Validate Badge
- **Green (Passing)**: All tests pass, code is ready for merge
- **Red (Failing)**: Tests failed, needs attention
- **Yellow (Pending)**: Tests are running

### Release Build Badge
- **Green (Success)**: Latest release built successfully
- **Red (Failed)**: Release build failed
- **No Badge**: No releases yet

### Codecov Badge
- Shows test coverage percentage
- Click to view detailed coverage report
- Updates automatically with each push

## Custom Badge Configuration

### Workflow-Specific Badges

For specific workflows:
```markdown
![Workflow Name](https://github.com/OWNER/REPO/actions/workflows/WORKFLOW_FILE.yml/badge.svg)
```

### Branch-Specific Badges

For specific branches:
```markdown
![Tests](https://github.com/OWNER/REPO/actions/workflows/test.yml/badge.svg?branch=main)
![Tests](https://github.com/OWNER/REPO/actions/workflows/test.yml/badge.svg?branch=beta)
```

### Event-Specific Badges

For specific events:
```markdown
![Tests](https://github.com/OWNER/REPO/actions/workflows/test.yml/badge.svg?event=push)
![Tests](https://github.com/OWNER/REPO/actions/workflows/test.yml/badge.svg?event=pull_request)
```

## Codecov Setup

1. **Sign up at Codecov.io** with your GitHub account
2. **Add repository** to Codecov dashboard
3. **Get CODECOV_TOKEN** from repository settings
4. **Add to GitHub Secrets**:
   - Go to repository Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `CODECOV_TOKEN`
   - Value: [paste token from Codecov]
5. **Badge auto-generates** after first coverage upload

## Alternative Badge Styles

### Shields.io Badges

More customization options:

```markdown
![Tests](https://img.shields.io/github/actions/workflow/status/OWNER/REPO/test.yml?label=tests&logo=github)
![Coverage](https://img.shields.io/codecov/c/github/OWNER/REPO?logo=codecov)
![License](https://img.shields.io/github/license/OWNER/REPO)
![Version](https://img.shields.io/github/v/release/OWNER/REPO)
```

### Flat Square Style

```markdown
![Tests](https://img.shields.io/github/actions/workflow/status/OWNER/REPO/test.yml?style=flat-square)
```

### For the Badge Style

```markdown
![Tests](https://img.shields.io/github/actions/workflow/status/OWNER/REPO/test.yml?style=for-the-badge)
```

## Example README Section

```markdown
# Sports Odds MCP

> Sports betting data and analytics platform with MCP server and web dashboard

## Status

[![Test & Validate](https://github.com/YOUR_USERNAME/BetTrack/workflows/Test%20%26%20Validate/badge.svg)](https://github.com/YOUR_USERNAME/BetTrack/actions/workflows/test.yml)
[![Release Build](https://github.com/YOUR_USERNAME/BetTrack/workflows/Release%20Build/badge.svg)](https://github.com/YOUR_USERNAME/BetTrack/actions/workflows/release.yml)
[![codecov](https://codecov.io/gh/YOUR_USERNAME/BetTrack/branch/main/graph/badge.svg)](https://codecov.io/gh/YOUR_USERNAME/BetTrack)
[![License](https://img.shields.io/github/license/YOUR_USERNAME/BetTrack)](LICENSE)

## Features

...
```

## Troubleshooting

### Badge Shows "Unknown"
- Workflow hasn't run yet
- Workflow file name mismatch
- Check workflow file exists in `.github/workflows/`

### Badge Not Updating
- Clear browser cache
- Check workflow is enabled in Actions settings
- Verify workflow is running on correct branch

### Codecov Badge Missing
- Ensure CODECOV_TOKEN is set in GitHub Secrets
- Check Codecov upload step in workflow
- Wait for first coverage report upload

## Resources

- [GitHub Actions Status Badge](https://docs.github.com/en/actions/monitoring-and-troubleshooting-workflows/adding-a-workflow-status-badge)
- [Shields.io Badge Generator](https://shields.io/)
- [Codecov Badge Documentation](https://docs.codecov.com/docs/status-badges)
