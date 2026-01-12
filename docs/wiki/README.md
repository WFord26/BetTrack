# BetTrack Wiki Documentation

Complete documentation for the BetTrack sports betting data platform.

## 📚 Wiki Structure

This folder contains all wiki documentation for the BetTrack project. These markdown files are designed to be published as GitHub Wiki pages.

## 🚀 Getting Started

Start here if you're new to BetTrack:

1. **[Home](home.md)** - Project overview and features
2. **[Quick Start](Quick-Start.md)** - Get running in 5 minutes
3. **[Installation Guide](Installation-Guide.md)** - Detailed setup instructions

## 📖 Core Documentation

### Component Guides

Detailed guides for each major component:

- **[MCP Server Guide](MCP-Server-Guide.md)** - Architecture, tools, and MCP development
- **[Frontend Guide](Frontend-Guide.md)** - React dashboard, Redux, components
- **[Backend Guide](Backend-Guide.md)** - Node.js API, services, scheduled jobs
- **[Database Guide](Database-Guide.md)** - Schema, migrations, queries, performance

### Reference Documentation

- **[API Documentation](API-DOCUMENTATION.md)** - Complete API reference (MCP + REST)
- **[Developer Guide](Developer-Guide.md)** - Contributing, code standards, testing

## 🗂️ File Organization

### Current Files

```
docs/wiki/
├── home.md                    # Wiki home page
├── Quick-Start.md            # 5-minute quick start guide
├── Installation-Guide.md     # Detailed installation
├── API-DOCUMENTATION.md      # Complete API reference
├── MCP-Server-Guide.md       # MCP server deep dive
├── Frontend-Guide.md         # React frontend guide
├── Backend-Guide.md          # Node.js backend guide
├── Database-Guide.md         # PostgreSQL/Prisma guide
├── Developer-Guide.md        # Contributing and development
└── README.md                 # This file
```

### Planned Files (TODO)

```
docs/wiki/
├── Troubleshooting.md        # Common issues and solutions
├── FAQ.md                    # Frequently asked questions
├── Configuration-Guide.md    # Environment variables
├── Supported-Sports.md       # Sport keys and codes
├── Betting-Markets.md        # All 70+ markets
├── Usage-Examples.md         # Common query examples
├── Architecture.md           # System architecture
└── Contributing-Guide.md     # Contribution workflow
```

## 📝 Documentation Standards

### File Naming

- Use kebab-case: `MCP-Server-Guide.md`
- Be descriptive: `Quick-Start.md` not `QS.md`
- Use `.md` extension for all markdown files

### Structure

All documentation files should include:

```markdown
# Page Title

Brief description of what this page covers.

## Table of Contents

- [Section 1](#section-1)
- [Section 2](#section-2)

---

## Section 1

Content...

---

## Next Steps

- [Related Guide 1](Guide1)
- [Related Guide 2](Guide2)
```

### Linking

**Internal wiki links** (relative, no `.md` extension):
```markdown
See the [MCP Server Guide](MCP-Server-Guide)
```

**External docs** (relative paths with extension):
```markdown
See [Build Scripts](../BUILD-SCRIPTS.md)
```

**External URLs** (full URLs):
```markdown
Visit [The Odds API](https://the-odds-api.com)
```

### Code Blocks

Always specify language for syntax highlighting:

````markdown
```python
def example():
    return "Hello"
```

```typescript
function example(): string {
  return "Hello";
}
```

```bash
npm install
```
````

### Headings

- Use H1 (`#`) for page title only
- Use H2 (`##`) for major sections
- Use H3 (`###`) for subsections
- Use H4 (`####`) sparingly

### Lists

**Unordered lists** for non-sequential items:
```markdown
- Item 1
- Item 2
- Item 3
```

**Ordered lists** for step-by-step instructions:
```markdown
1. First step
2. Second step
3. Third step
```

## 🔄 Publishing to GitHub Wiki

### Initial Setup

```bash
# Clone wiki repository
git clone https://github.com/WFord26/BetTrack.wiki.git

# Copy files from docs/wiki/ to wiki repository
cp docs/wiki/*.md BetTrack.wiki/

# Push to wiki
cd BetTrack.wiki
git add .
git commit -m "Update documentation"
git push
```

### Update Workflow

When updating documentation:

1. Edit files in `docs/wiki/` (source of truth)
2. Test locally with markdown previewer
3. Commit changes to main repository
4. Copy updated files to wiki repository
5. Push to wiki repository

## ✅ Pre-Publishing Checklist

Before publishing wiki updates:

- [ ] All internal links work (test with VS Code markdown preview)
- [ ] Code blocks have language specified
- [ ] Tables are properly formatted
- [ ] No broken external links
- [ ] Consistent heading hierarchy
- [ ] Table of contents is accurate
- [ ] Updated "BetTrack" name (not "Sports-Odds-MCP")
- [ ] Examples use correct paths and URLs

## 📐 File Templates

### Component Guide Template

```markdown
# [Component] Guide

Complete guide to the BetTrack [component] - [brief description].

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Key Features](#key-features)
- [Development](#development)
- [Examples](#examples)

---

## Overview

[Component description and purpose]

---

## Architecture

[Technical details, design patterns]

---

## Key Features

[List of major features with examples]

---

## Development

[Setup, configuration, common tasks]

---

## Examples

[Code examples and use cases]

---

## Next Steps

- [Related Guide 1](Related-Guide-1)
- [Related Guide 2](Related-Guide-2)
```

### Tutorial Template

```markdown
# [Task] Tutorial

Learn how to [task description].

## Prerequisites

- Requirement 1
- Requirement 2

## Steps

### Step 1: [First Step]

[Instructions with code examples]

### Step 2: [Second Step]

[Instructions with code examples]

### Step 3: [Third Step]

[Instructions with code examples]

## Verification

[How to verify task was completed successfully]

## Troubleshooting

Common issues and solutions:

**Issue**: [Problem description]
**Solution**: [Fix]

## Next Steps

- [Related Tutorial 1](Tutorial1)
- [Advanced Topic](Advanced-Topic)
```

## 🎯 Documentation Goals

1. **Comprehensive**: Cover all aspects of the project
2. **Accessible**: Easy for beginners to understand
3. **Accurate**: Keep up-to-date with code changes
4. **Organized**: Clear hierarchy and navigation
5. **Searchable**: Good keywords and cross-references

## 🤝 Contributing to Documentation

### Small Fixes

For typos, broken links, or minor clarifications:

1. Edit file directly in GitHub web interface
2. Create pull request
3. Maintainers will review and merge

### Major Updates

For new pages or significant rewrites:

1. Create issue describing proposed changes
2. Get feedback from maintainers
3. Create pull request with changes
4. Include screenshots if UI-related
5. Update this README if adding new files

## 📞 Documentation Help

- **Questions?** Ask in [GitHub Discussions](https://github.com/WFord26/BetTrack/discussions)
- **Issues?** Report in [GitHub Issues](https://github.com/WFord26/BetTrack/issues) with `documentation` label
- **Suggestions?** Open discussion in "Ideas" category

---

**Last Updated**: January 12, 2026  
**Maintainer**: William Ford  
**Repository**: [github.com/WFord26/BetTrack](https://github.com/WFord26/BetTrack)
