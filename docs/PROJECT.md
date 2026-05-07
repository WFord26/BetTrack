# BetTrack — Project Documentation

**Last updated:** April 15, 2026

## Overview

BetTrack is a dual-platform sports betting analytics and portfolio tracking system. It combines real-time sports data with intelligent bet management across 7+ major sports (NFL, NBA, MLB, NHL, WNBA, NCAA Football, NCAA Basketball).

### Architecture

BetTrack consists of two coordinated applications sharing a PostgreSQL backend:

| Component | Stack | Purpose |
|-----------|-------|---------|
| **MCP Server** | Python 3.11+, FastMCP, aiohttp | Claude Desktop integration — 23+ conversational betting tools |
| **Dashboard Backend** | Node.js 20, Express, TypeScript, Prisma ORM | REST API, background jobs (odds sync, bet settlement, CLV capture) |
| **Dashboard Frontend** | React 18, Vite, Redux Toolkit, Tailwind CSS, Recharts | Web dashboard with retro 8-bit aesthetic |
| **Database** | PostgreSQL 16 | Shared data store for bets, odds, games, analytics |
| **Infrastructure** | Docker, Nginx, Let's Encrypt SSL | Self-hosted deployment |

### Data Sources

- **The Odds API** — Real-time odds from 70+ betting markets across multiple bookmakers
- **ESPN API** — Scores, schedules, rosters, team stats, injury reports

### Key Feature Flags

| Flag | Default | Purpose |
|------|---------|---------|
| `ENABLE_CLOSING_LINE_CAPTURE` | true | Controls CLV cron job |
| `ENABLE_WEBSOCKETS` | false | WebSocket real-time updates (not yet active) |
| `AUTH_MODE` | none | Authentication: `none`, `oauth2` (Microsoft/Google) |
| `API_SPORTS_TIER` | free | API-Sports subscription level |

---

## Product Roadmap

### Strategic Themes

1. **AI-Native Moat** — Deepen the conversational betting experience via MCP that no competitor matches
2. **Serious Bettor's Toolkit** — Close feature gaps vs BetStamp; best portfolio management for serious bettors
3. **Privacy-First Positioning** — "Your data stays yours" — self-hosted deployment as competitive differentiator

### Roadmap Summary

| ADR | Item | Phase | Effort | Dependencies | GitHub Issue |
|-----|------|-------|--------|--------------|-------------|
| 001 | Conversational Portfolio Queries via MCP | Now | M (1-2 wk) | None | New |
| 002 | +EV Opportunity Screener (v1) | Now | L (3-4 wk) | CLV (done), #4, #7 | New |
| 003 | Progressive Web App Setup | Now | S (days) | None | New |
| 004 | Daily P&L Tracking | Now | S (days) | None (existing TODO) | New |
| 005 | WebSocket Real-Time Updates | Now | M (1-2 wk) | Feature flag exists | New |
| 006 | API Data Licensing Investigation | Now | S (days) | Gates ADR-013 | New |
| 007 | Bookmaker Disagreement Detection | Now | M (~9 days) | Odds API | #4 (existing) |
| 008 | Line Movement Classification | Now | M (~10 days) | ADR-005 (WebSocket) | #5 (existing) |
| 009 | Sportsbook Account Sync (Top 5) | Next | XL (6+ wk) | None | New |
| 010 | AI Bet Research Assistant (Enhanced) | Next | L (3-4 wk) | ADR-001 | New |
| 011 | Bankroll Management Module | Next | M (1-2 wk) | ADR-004 | New |
| 012 | AI-Powered Alerts & Notifications | Next | M (1-2 wk) | ADR-002, 005, 008 | New |
| 013 | Paid Data API for Self-Hosted | Next | L (3-4 wk) | ADR-006 (licensing) | New |
| 014 | Sharp vs Public Money Indicators | Next | M (~12 days) | ADR-008 | #6 (existing) |
| 015 | Market Consensus & Deviations | Next | M (~11 days) | ADR-007 | #7 (existing) |
| 016 | Bookmaker Analytics & Rankings | Next | L (~15 days) | ADR-015, 007 | #8 (existing) |
| 017 | Privacy & Self-Hosting Marketing Page | Next | S (days) | None | New |

### Dependency Graph

```
CLV Service (DONE)
├── ADR-002: +EV Screener
│   ├── ADR-012: AI Alerts
│   └── (depends on ADR-007 + ADR-004)
│
ADR-001: Portfolio Queries
└── ADR-010: AI Research Assistant

ADR-004: Daily P&L
└── ADR-011: Bankroll Management

ADR-005: WebSocket
├── ADR-008: Line Movement Classification
│   ├── ADR-014: Sharp Money Indicators
│   └── ADR-012: AI Alerts
└── ADR-012: AI Alerts

ADR-007: Bookmaker Disagreement
├── ADR-015: Market Consensus
│   └── ADR-016: Bookmaker Analytics
└── ADR-002: +EV Screener

ADR-006: Licensing Investigation
└── ADR-013: Paid Data API

ADR-003: PWA Setup (independent)
ADR-009: Sportsbook Sync (independent)
ADR-017: Privacy Marketing (independent)
```

### Critical Path

The longest dependency chain is:
**ADR-007 (Disagreement) → ADR-015 (Consensus) → ADR-016 (Bookmaker Analytics)**

The highest-value chain is:
**ADR-007 (Disagreement) + ADR-005 (WebSocket) → ADR-002 (+EV Screener) → ADR-012 (AI Alerts)**

### Parallelizable Work

These items have no dependencies and can start immediately in parallel:
- ADR-001 (Portfolio Queries)
- ADR-003 (PWA)
- ADR-004 (Daily P&L)
- ADR-005 (WebSocket)
- ADR-006 (Licensing Investigation)
- ADR-007 (Bookmaker Disagreement)

---

## Architecture Decision Records

All ADRs are in [`docs/architecture/`](./architecture/):

| ADR | Document |
|-----|----------|
| 001 | [Conversational Portfolio Queries](./architecture/adr-001-conversational-portfolio-queries.md) |
| 002 | [+EV Opportunity Screener](./architecture/adr-002-ev-opportunity-screener.md) |
| 003 | [Progressive Web App](./architecture/adr-003-progressive-web-app.md) |
| 004 | [Daily P&L Tracking](./architecture/adr-004-daily-pnl-tracking.md) |
| 005 | [WebSocket Real-Time](./architecture/adr-005-websocket-realtime.md) |
| 006 | [API Licensing Investigation](./architecture/adr-006-api-licensing-investigation.md) |
| 007 | [Bookmaker Disagreement](./architecture/adr-007-bookmaker-disagreement.md) |
| 008 | [Line Movement Classification](./architecture/adr-008-line-movement-classification.md) |
| 009 | [Sportsbook Sync](./architecture/adr-009-sportsbook-sync.md) |
| 010 | [AI Research Assistant](./architecture/adr-010-ai-research-assistant.md) |
| 011 | [Bankroll Management](./architecture/adr-011-bankroll-management.md) |
| 012 | [AI Alerts](./architecture/adr-012-ai-alerts.md) |
| 013 | [Paid Data API](./architecture/adr-013-paid-data-api.md) |
| 014 | [Sharp Money Indicators](./architecture/adr-014-sharp-money-indicators.md) |
| 015 | [Market Consensus](./architecture/adr-015-market-consensus.md) |
| 016 | [Bookmaker Analytics](./architecture/adr-016-bookmaker-analytics.md) |
| 017 | [Privacy & Self-Hosting](./architecture/adr-017-privacy-self-hosting.md) |

---

## Development Setup

See the main [README.md](../README.md) for setup instructions. Key requirements:

- **MCP Server:** Python 3.11+, `pip install -r requirements.txt`
- **Dashboard:** Node.js 20, PostgreSQL 16, `npm install` in `dashboard/`
- **Docker:** `docker-compose up` in `dashboard/` for full stack
- **Environment:** Copy `.env.example` to `.env` and configure API keys

---

## GitHub Setup

To create milestones, issues, and labels from this roadmap:

```bash
# Requires gh CLI authenticated with repo access
bash docs/setup-github-roadmap.sh
```

This script creates 2 milestones, 8 labels, 11 new issues, updates 5 existing issues with milestones, and closes Issue #3 (CLV Tracking — already implemented).
