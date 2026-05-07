---
description: "Scaffold a new wiki page in docs/wiki/ with correct structure, TOC, and linking conventions"
argument-hint: "Page title, e.g. 'Troubleshooting' or 'Configuration Guide'"
agent: "agent"
---

Create a new wiki page in `docs/wiki/` following these rules:

1. **Filename**: Convert the page title to `Kebab-Case.md` (e.g., "Configuration Guide" → `Configuration-Guide.md`)
2. **Structure**: Use this template:
   - `#` Page title
   - Brief one-line description
   - `## Table of Contents` with anchor links to all `##` and `###` sections
   - `---` between major sections
   - `## Next Steps` at the bottom linking to related wiki pages
3. **Links**: All cross-page links use `.md` extension: `[Guide](Quick-Start.md)`
4. **Code blocks**: Always specify a language
5. **Images**: Use `https://raw.githubusercontent.com/WFord26/BetTrack/main/...` URLs

Refer to the wiki-documentation skill and [wiki-docs instructions](../instructions/wiki-docs.instructions.md) for full linking rules.

After creating the page, update `docs/wiki/home.md` and `docs/wiki/README.md` to include a link to the new page.
