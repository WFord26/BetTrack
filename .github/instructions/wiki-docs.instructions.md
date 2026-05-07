---
description: "Wiki documentation link formatting and structure rules. Enforces .md-extension cross-page links, correct anchor syntax, and consistent page structure for GitHub Wiki publishing."
applyTo: "docs/wiki/**"
---

# Wiki Documentation Standards

## Link Formats

**Cross-page links** — use filename with `.md` extension, no path prefix:

```markdown
✅ [Quick Start](Quick-Start.md)
✅ [Database Guide](Database-Guide.md)

❌ [Quick Start](Quick-Start)           ← missing .md
❌ [Quick Start](./Quick-Start.md)      ← unnecessary prefix
❌ [Quick Start](/wiki/Quick-Start.md)  ← absolute path
```

**Anchor links** — lowercase, hyphens for spaces, drop punctuation:

```markdown
✅ [Core Models](#core-models)
✅ [Indexes & Performance](#indexes--performance)
✅ [Step 1: Setup](#step-1-setup)
```

**Cross-page anchors** — combine filename + anchor:

```markdown
✅ [Game Model](Database-Guide.md#core-models)
```

**Images** — use raw GitHub CDN, never relative paths:

```markdown
✅ ![Logo](https://raw.githubusercontent.com/WFord26/BetTrack/main/assets/logo.png)
❌ ![Logo](../../assets/logo.png)
```

## Page Structure

- Single `#` for page title only
- `##` for major sections, `###` for subsections
- Table of Contents after intro paragraph (link to `##` and `###` headings)
- Horizontal rules (`---`) between major sections
- "Next Steps" or "See Also" section at the bottom
- All code blocks must specify a language

## File Naming

Use `Kebab-Case.md`: `Quick-Start.md`, `API-DOCUMENTATION.md`, `Database-Guide.md`.

## Repo References

- Repository: `WFord26/BetTrack` (not `Sports-Odds-MCP`, not `yourusername`)
- GitHub URL: `https://github.com/WFord26/BetTrack`
