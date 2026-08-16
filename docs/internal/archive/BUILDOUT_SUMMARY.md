# BetTrack Roadmap Buildout Summary

**Generated:** April 15, 2026

## What Was Created

### Milestones (via setup script)
| Milestone | Phase | Items |
|-----------|-------|-------|
| Phase: Now — Current Sprint | Now | 8 items |
| Phase: Next — 1-3 Months | Next | 9 items |

### Architecture Decision Records (17 files)

| File | ADR | Phase | Status |
|------|-----|-------|--------|
| `adr-001-conversational-portfolio-queries.md` | ADR-001 | Now | Proposed |
| `adr-002-ev-opportunity-screener.md` | ADR-002 | Now | Proposed |
| `adr-003-progressive-web-app.md` | ADR-003 | Now | Proposed |
| `adr-004-daily-pnl-tracking.md` | ADR-004 | Now | Proposed |
| `adr-005-websocket-realtime.md` | ADR-005 | Now | Proposed |
| `adr-006-api-licensing-investigation.md` | ADR-006 | Now | Proposed |
| `adr-007-bookmaker-disagreement.md` | ADR-007 | Now | Proposed |
| `adr-008-line-movement-classification.md` | ADR-008 | Now | Proposed |
| `adr-009-sportsbook-sync.md` | ADR-009 | Next | Proposed |
| `adr-010-ai-research-assistant.md` | ADR-010 | Next | Proposed |
| `adr-011-bankroll-management.md` | ADR-011 | Next | Proposed |
| `adr-012-ai-alerts.md` | ADR-012 | Next | Proposed |
| `adr-013-paid-data-api.md` | ADR-013 | Next | Proposed |
| `adr-014-sharp-money-indicators.md` | ADR-014 | Next | Proposed |
| `adr-015-market-consensus.md` | ADR-015 | Next | Proposed |
| `adr-016-bookmaker-analytics.md` | ADR-016 | Next | Proposed |
| `adr-017-privacy-self-hosting.md` | ADR-017 | Next | Proposed |

### GitHub Issues (via setup script)

| Action | Issue | Milestone |
|--------|-------|-----------|
| **CREATE** | [Now] Conversational Portfolio Queries via MCP | Phase: Now |
| **CREATE** | [Now] +EV Opportunity Screener (v1) | Phase: Now |
| **CREATE** | [Now] Progressive Web App (PWA) Setup | Phase: Now |
| **CREATE** | [Now] Daily P&L Tracking | Phase: Now |
| **CREATE** | [Now] WebSocket Real-Time Updates | Phase: Now |
| **CREATE** | [Now] API Data Licensing Investigation | Phase: Now |
| **UPDATE** | #4 Bookmaker Disagreement Detection | Phase: Now |
| **UPDATE** | #5 Line Movement Tracking | Phase: Now |
| **CREATE** | [Next] Sportsbook Account Sync (Top 5) | Phase: Next |
| **CREATE** | [Next] AI Bet Research Assistant (Enhanced MCP) | Phase: Next |
| **CREATE** | [Next] Bankroll Management Module | Phase: Next |
| **CREATE** | [Next] AI-Powered Alerts & Notifications | Phase: Next |
| **CREATE** | [Next] Paid Data API for Self-Hosted Instances | Phase: Next |
| **CREATE** | [Next] Privacy & Self-Hosting Marketing Page | Phase: Next |
| **UPDATE** | #6 Sharp vs Public Money Indicators | Phase: Next |
| **UPDATE** | #7 Market Consensus & Deviations | Phase: Next |
| **UPDATE** | #8 Bookmaker Analytics & Rankings | Phase: Next |
| **CLOSE** | #3 CLV Tracking (already implemented) | — |

### Labels Created
- `architecture` — Architecture Decision Record
- `phase:now` — Current sprint
- `phase:next` — 1-3 months out
- `ai-mcp` — AI & MCP server work
- `data-analytics` — Data & analytics features
- `ux-platform` — UX & platform improvements
- `infra` — Infrastructure & DevOps
- `growth` — Growth & monetization

### Project Documentation
| File | Purpose |
|------|---------|
| `docs/PROJECT.md` | Project overview, roadmap table, dependency graph, ADR index |
| `docs/BUILDOUT_SUMMARY.md` | This file — summary of everything generated |
| `docs/setup-github-roadmap.sh` | Shell script to create milestones/issues on GitHub |

## How to Apply

```bash
# From the BetTrack repo root:
bash docs/setup-github-roadmap.sh
```

Requires `gh` CLI authenticated with write access to `WFord26/BetTrack`.

## Companion Files

- **Competitive Brief:** `BetTrack_Competitive_Brief.html`
- **Product Roadmap:** `BetTrack_Roadmap.html`

## Notes

- Web search was unavailable during competitor research. Verify competitor pricing before making strategic decisions.
- ADR-006 (Licensing Investigation) is a research task — it uses a checklist format rather than traditional ADR structure.
- Issue #3 (CLV Tracking) is already fully implemented in the codebase and will be closed by the script.
- ADRs include real Prisma schema snippets, API endpoint signatures, MCP tool definitions, and React component structures.
