#!/bin/bash
# ============================================================================
# BetTrack Roadmap — GitHub Milestones & Issues Setup Script
# Run from the BetTrack repo root with gh CLI authenticated.
# Usage: bash docs/setup-github-roadmap.sh
# ============================================================================

set -euo pipefail
REPO="WFord26/BetTrack"

echo "========================================"
echo "BetTrack Roadmap — GitHub Setup"
echo "========================================"
echo ""

# --------------------------------------------------
# 1. Create Milestones
# --------------------------------------------------
echo "--- Creating Milestones ---"

NOW_MILESTONE=$(gh api repos/$REPO/milestones --method POST \
  -f title="Phase: Now — Current Sprint" \
  -f description="Committed work for the current sprint. High confidence in scope and timeline." \
  -f state="open" \
  --jq '.number' 2>/dev/null || echo "")

if [ -z "$NOW_MILESTONE" ]; then
  echo "  'Phase: Now' milestone may already exist. Fetching..."
  NOW_MILESTONE=$(gh api repos/$REPO/milestones --jq '.[] | select(.title=="Phase: Now — Current Sprint") | .number')
fi
echo "  Phase: Now milestone = #$NOW_MILESTONE"

NEXT_MILESTONE=$(gh api repos/$REPO/milestones --method POST \
  -f title="Phase: Next — 1-3 Months" \
  -f description="Planned work for the next 1-3 months. Scoped and prioritized, not yet started." \
  -f state="open" \
  --jq '.number' 2>/dev/null || echo "")

if [ -z "$NEXT_MILESTONE" ]; then
  echo "  'Phase: Next' milestone may already exist. Fetching..."
  NEXT_MILESTONE=$(gh api repos/$REPO/milestones --jq '.[] | select(.title=="Phase: Next — 1-3 Months") | .number')
fi
echo "  Phase: Next milestone = #$NEXT_MILESTONE"

echo ""

# --------------------------------------------------
# 2. Create labels (idempotent)
# --------------------------------------------------
echo "--- Creating Labels ---"
gh label create "architecture" --description "Architecture Decision Record" --color "1d76db" --repo $REPO 2>/dev/null || echo "  Label 'architecture' already exists"
gh label create "phase:now" --description "Current sprint" --color "00b894" --repo $REPO 2>/dev/null || echo "  Label 'phase:now' already exists"
gh label create "phase:next" --description "1-3 months out" --color "74b9ff" --repo $REPO 2>/dev/null || echo "  Label 'phase:next' already exists"
gh label create "ai-mcp" --description "AI & MCP server work" --color "6c5ce7" --repo $REPO 2>/dev/null || echo "  Label 'ai-mcp' already exists"
gh label create "data-analytics" --description "Data & analytics features" --color "00cec9" --repo $REPO 2>/dev/null || echo "  Label 'data-analytics' already exists"
gh label create "ux-platform" --description "UX & platform improvements" --color "74b9ff" --repo $REPO 2>/dev/null || echo "  Label 'ux-platform' already exists"
gh label create "infra" --description "Infrastructure & DevOps" --color "fdcb6e" --repo $REPO 2>/dev/null || echo "  Label 'infra' already exists"
gh label create "growth" --description "Growth & monetization" --color "fd79a8" --repo $REPO 2>/dev/null || echo "  Label 'growth' already exists"
echo ""

# --------------------------------------------------
# 3. Create NEW issues (Now phase — items without existing GitHub issues)
# --------------------------------------------------
echo "--- Creating Now Phase Issues ---"

echo "  Creating: [Now] Conversational Portfolio Queries via MCP"
gh issue create --repo $REPO \
  --title "[Now] Conversational Portfolio Queries via MCP" \
  --label "enhancement,architecture,phase:now,ai-mcp" \
  --milestone "$NOW_MILESTONE" \
  --body "$(cat <<'ISSUE_EOF'
## ADR-001: Conversational Portfolio Queries via MCP

Add MCP tools for natural language portfolio analytics — enabling queries like "What's my ROI on NBA unders?" or "Which bookmaker gives me the best results?"

**See full ADR:** [`docs/architecture/adr-001-conversational-portfolio-queries.md`](../docs/architecture/adr-001-conversational-portfolio-queries.md)

### Key Deliverables
- 5 new MCP tools: `get_portfolio_summary`, `get_roi_by_sport`, `get_roi_by_bookmaker`, `get_bet_history_filtered`, `get_streak_analysis`
- Python FastMCP implementation querying existing PostgreSQL via dashboard API
- Unit tests for each tool

### Acceptance Criteria
- [ ] `get_portfolio_summary` returns total bets, win rate, ROI, P&L
- [ ] `get_roi_by_sport` breaks down performance by sport with filters
- [ ] `get_roi_by_bookmaker` ranks bookmaker performance
- [ ] `get_bet_history_filtered` supports date, sport, outcome, bet type filters
- [ ] `get_streak_analysis` identifies winning/losing streaks
- [ ] All tools handle empty result sets gracefully
- [ ] Integration tests pass against test database

### Effort: M (1-2 weeks)
### Dependencies: None (existing bet data + MCP server)
ISSUE_EOF
)"

echo "  Creating: [Now] +EV Opportunity Screener (v1)"
gh issue create --repo $REPO \
  --title "[Now] +EV Opportunity Screener (v1)" \
  --label "enhancement,architecture,phase:now,data-analytics,ai-mcp" \
  --milestone "$NOW_MILESTONE" \
  --body "$(cat <<'ISSUE_EOF'
## ADR-002: +EV Opportunity Screener (v1)

Build a positive expected value screener that identifies mispriced lines by comparing each bookmaker's odds to market consensus.

**See full ADR:** [`docs/architecture/adr-002-ev-opportunity-screener.md`](../docs/architecture/adr-002-ev-opportunity-screener.md)

### Key Deliverables
- `EVScreenerService` with scheduled scanning
- `EVOpportunity` Prisma model
- Dashboard page with filters and sorting
- MCP tool: `find_ev_opportunities`

### Acceptance Criteria
- [ ] EVScreenerService calculates edge % vs consensus for all active markets
- [ ] Opportunities persisted with TTL-based expiration
- [ ] Dashboard shows +EV opportunities filterable by sport, edge %, bookmaker
- [ ] MCP tool returns current +EV plays via natural language
- [ ] Historical tracking of +EV accuracy (did +EV picks actually win more?)
- [ ] Performance: scan completes in < 30 seconds for all active games

### Effort: L (3-4 weeks)
### Dependencies: CLV service (done), #4 (Bookmaker Disagreement), #7 (Market Consensus)
ISSUE_EOF
)"

echo "  Creating: [Now] Progressive Web App Setup"
gh issue create --repo $REPO \
  --title "[Now] Progressive Web App (PWA) Setup" \
  --label "enhancement,architecture,phase:now,ux-platform" \
  --milestone "$NOW_MILESTONE" \
  --body "$(cat <<'ISSUE_EOF'
## ADR-003: Progressive Web App Setup

Make the BetTrack dashboard installable on mobile via PWA — manifest, service worker, and offline caching.

**See full ADR:** [`docs/architecture/adr-003-progressive-web-app.md`](../docs/architecture/adr-003-progressive-web-app.md)

### Key Deliverables
- Web manifest with app icons
- Service worker via vite-plugin-pwa
- Offline caching for static assets + API responses
- Install prompt and update notification

### Acceptance Criteria
- [ ] Lighthouse PWA audit passes
- [ ] Dashboard installable on iOS Safari and Android Chrome
- [ ] Offline mode shows cached data with "offline" indicator
- [ ] Service worker updates prompt user to refresh
- [ ] App icons render correctly on home screen

### Effort: S (days)
### Dependencies: None
ISSUE_EOF
)"

echo "  Creating: [Now] Daily P&L Tracking"
gh issue create --repo $REPO \
  --title "[Now] Daily P&L Tracking" \
  --label "enhancement,architecture,phase:now,data-analytics" \
  --milestone "$NOW_MILESTONE" \
  --body "$(cat <<'ISSUE_EOF'
## ADR-004: Daily P&L Tracking

Implement daily profit/loss aggregation with charts. Addresses existing TODO in Stats.tsx.

**See full ADR:** [`docs/architecture/adr-004-daily-pnl-tracking.md`](../docs/architecture/adr-004-daily-pnl-tracking.md)

### Key Deliverables
- `DailyPnL` Prisma model
- `PnLService` with nightly cron aggregation
- REST endpoints: `/api/pnl/daily`, `/api/pnl/weekly`, `/api/pnl/monthly`
- Recharts P&L charts integrated into Stats page

### Acceptance Criteria
- [ ] Daily P&L aggregated automatically via cron
- [ ] API supports date range, sport, and bookmaker filters
- [ ] Charts show daily/weekly/monthly views with toggle
- [ ] Running total line overlaid on bar chart
- [ ] Handles days with no bets gracefully (zero, not missing)

### Effort: S (days)
### Dependencies: None (resolves existing TODO)
ISSUE_EOF
)"

echo "  Creating: [Now] WebSocket Real-Time Updates"
gh issue create --repo $REPO \
  --title "[Now] WebSocket Real-Time Updates" \
  --label "enhancement,architecture,phase:now,infra" \
  --milestone "$NOW_MILESTONE" \
  --body "$(cat <<'ISSUE_EOF'
## ADR-005: WebSocket Real-Time Updates

Enable the ENABLE_WEBSOCKETS feature flag and implement real-time push for scores, odds, and bet settlements.

**See full ADR:** [`docs/architecture/adr-005-websocket-realtime.md`](../docs/architecture/adr-005-websocket-realtime.md)

### Key Deliverables
- Socket.IO server integrated with Express
- Events: `odds_update`, `score_update`, `bet_settled`, `line_movement`
- Frontend WebSocket context provider
- Real-time indicators on dashboard

### Acceptance Criteria
- [ ] Socket.IO server starts when ENABLE_WEBSOCKETS=true
- [ ] Odds sync job emits `odds_update` events
- [ ] Bet settlement job emits `bet_settled` events
- [ ] Dashboard updates in real-time without page refresh
- [ ] Graceful reconnection on disconnect
- [ ] No performance regression when WebSocket is disabled

### Effort: M (1-2 weeks)
### Dependencies: Feature flag exists (ENABLE_WEBSOCKETS)
ISSUE_EOF
)"

echo "  Creating: [Now] API Data Licensing Investigation"
gh issue create --repo $REPO \
  --title "[Now] API Data Licensing Investigation" \
  --label "enhancement,phase:now,growth" \
  --milestone "$NOW_MILESTONE" \
  --body "$(cat <<'ISSUE_EOF'
## Investigation: API Data Licensing for Paid API

Research task — determine if BetTrack can legally resell aggregated/derived data via a paid API.

**See full doc:** [`docs/architecture/adr-006-api-licensing-investigation.md`](../docs/architecture/adr-006-api-licensing-investigation.md)

### Checklist
- [ ] Review The Odds API Terms of Service for redistribution clauses
- [ ] Review ESPN API Terms of Service for data usage restrictions
- [ ] Determine what degree of data transformation qualifies as "derived"
- [ ] Document attribution/credit requirements for each API
- [ ] Research whether other companies resell similar odds data (precedent)
- [ ] Contact The Odds API team about reseller/enterprise licensing
- [ ] Contact ESPN API team if needed
- [ ] Assess revenue-sharing or licensing fee requirements
- [ ] Consult legal counsel if ToS is ambiguous
- [ ] Write licensing-findings.md with GO / NO-GO recommendation
- [ ] If NO-GO on raw data: define what derived products ARE permissible

### Effort: S (days)
### Dependencies: Gates ADR-013 (Paid Data API)
ISSUE_EOF
)"

echo ""

# --------------------------------------------------
# 4. Update EXISTING issues (#4, #5) with milestone
# --------------------------------------------------
echo "--- Updating Existing Now Phase Issues ---"

echo "  Updating Issue #4 (Bookmaker Disagreement) — adding milestone + labels"
gh issue edit 4 --repo $REPO \
  --milestone "$NOW_MILESTONE" \
  --add-label "architecture,phase:now,data-analytics" 2>/dev/null || echo "    Warning: could not update #4"

echo "  Updating Issue #5 (Line Movement) — adding milestone + labels"
gh issue edit 5 --repo $REPO \
  --milestone "$NOW_MILESTONE" \
  --add-label "architecture,phase:now,data-analytics" 2>/dev/null || echo "    Warning: could not update #5"

echo ""

# --------------------------------------------------
# 5. Create NEW issues (Next phase)
# --------------------------------------------------
echo "--- Creating Next Phase Issues ---"

echo "  Creating: [Next] Sportsbook Account Sync (Top 5)"
gh issue create --repo $REPO \
  --title "[Next] Sportsbook Account Sync (Top 5)" \
  --label "enhancement,architecture,phase:next,data-analytics,infra" \
  --milestone "$NEXT_MILESTONE" \
  --body "$(cat <<'ISSUE_EOF'
## ADR-009: Sportsbook Account Sync

Integrate with DraftKings, FanDuel, BetMGM, Caesars, and ESPN BET for automatic bet slip import.

**See full ADR:** [`docs/architecture/adr-009-sportsbook-sync.md`](../docs/architecture/adr-009-sportsbook-sync.md)

### Key Deliverables
- Provider adapter pattern (OAuth, scraping, CSV fallback)
- `SportsbookConnection` and `ImportedBet` Prisma models
- Queue-based sync processing with retry logic
- Connection management UI

### Acceptance Criteria
- [ ] At least 2 sportsbooks connected via OAuth or extension
- [ ] CSV import fallback works for all 5 books
- [ ] Imported bets deduplicated against manual entries
- [ ] Sync status visible in dashboard
- [ ] Credentials encrypted at rest
- [ ] Retry logic for failed syncs with exponential backoff

### Effort: XL (6+ weeks)
### Dependencies: None (can start independently)
ISSUE_EOF
)"

echo "  Creating: [Next] AI Bet Research Assistant (Enhanced)"
gh issue create --repo $REPO \
  --title "[Next] AI Bet Research Assistant (Enhanced MCP)" \
  --label "enhancement,architecture,phase:next,ai-mcp" \
  --milestone "$NEXT_MILESTONE" \
  --body "$(cat <<'ISSUE_EOF'
## ADR-010: AI Bet Research Assistant

Expand MCP tools for multi-step research workflows combining ESPN data, odds, and historical performance.

**See full ADR:** [`docs/architecture/adr-010-ai-research-assistant.md`](../docs/architecture/adr-010-ai-research-assistant.md)

### Key Deliverables
- MCP tools: `compare_h2h_matchups`, `get_injury_report`, `analyze_matchup`, `get_betting_recommendation`
- Multi-source data aggregation layer
- Recommendation engine with confidence scoring

### Acceptance Criteria
- [ ] H2H comparison returns last N matchups with stats
- [ ] Injury report aggregates from ESPN with betting impact assessment
- [ ] Matchup analysis combines multiple data sources into coherent summary
- [ ] Recommendations include confidence level and reasoning
- [ ] Tools handle missing data gracefully

### Effort: L (3-4 weeks)
### Dependencies: ADR-001 (Portfolio Queries)
ISSUE_EOF
)"

echo "  Creating: [Next] Bankroll Management Module"
gh issue create --repo $REPO \
  --title "[Next] Bankroll Management Module" \
  --label "enhancement,architecture,phase:next,ux-platform,data-analytics" \
  --milestone "$NEXT_MILESTONE" \
  --body "$(cat <<'ISSUE_EOF'
## ADR-011: Bankroll Management Module

Bankroll tracking with unit sizing (flat, percentage, Kelly Criterion) and overexposure alerts.

**See full ADR:** [`docs/architecture/adr-011-bankroll-management.md`](../docs/architecture/adr-011-bankroll-management.md)

### Key Deliverables
- `Bankroll` and `BankrollTransaction` Prisma models
- Kelly Criterion calculator
- Exposure monitoring by sport/league/bet type
- MCP tools: `get_bankroll_status`, `calculate_kelly_stake`

### Acceptance Criteria
- [ ] Bankroll CRUD with deposit/withdrawal tracking
- [ ] Unit sizing calculator supports flat, percentage, and Kelly methods
- [ ] Exposure alerts fire when concentration exceeds thresholds
- [ ] Dashboard shows bankroll history chart
- [ ] MCP tools return bankroll status and stake recommendations

### Effort: M (1-2 weeks)
### Dependencies: ADR-004 (Daily P&L Tracking)
ISSUE_EOF
)"

echo "  Creating: [Next] AI-Powered Alerts & Notifications"
gh issue create --repo $REPO \
  --title "[Next] AI-Powered Alerts & Notifications" \
  --label "enhancement,architecture,phase:next,ai-mcp" \
  --milestone "$NEXT_MILESTONE" \
  --body "$(cat <<'ISSUE_EOF'
## ADR-012: AI-Powered Alerts & Notifications

Smart alerts for line movement, +EV opportunities, injury impact, and bet settlements.

**See full ADR:** [`docs/architecture/adr-012-ai-alerts.md`](../docs/architecture/adr-012-ai-alerts.md)

### Key Deliverables
- `AlertRule` and `AlertHistory` Prisma models
- Rule engine with configurable conditions
- In-app notification delivery (future: email/push)
- MCP tools: `get_alerts`, `configure_alert`

### Acceptance Criteria
- [ ] Users can create custom alert rules
- [ ] Line movement alerts fire within 1 minute of detection
- [ ] +EV alerts surface opportunities above configurable threshold
- [ ] Alert deduplication prevents spam
- [ ] Notification panel shows alert history
- [ ] MCP tool can query and configure alerts

### Effort: M (1-2 weeks)
### Dependencies: ADR-002 (+EV Screener), ADR-005 (WebSocket), ADR-008 (Line Movement)
ISSUE_EOF
)"

echo "  Creating: [Next] Paid Data API for Self-Hosted Instances"
gh issue create --repo $REPO \
  --title "[Next] Paid Data API for Self-Hosted Instances" \
  --label "enhancement,architecture,phase:next,growth,infra" \
  --milestone "$NEXT_MILESTONE" \
  --body "$(cat <<'ISSUE_EOF'
## ADR-013: Paid Data API

Subscription API for self-hosted BetTrack instances to pull aggregated odds, line movement, CLV benchmarks, and +EV signals.

**See full ADR:** [`docs/architecture/adr-013-paid-data-api.md`](../docs/architecture/adr-013-paid-data-api.md)

### Key Deliverables
- API key management with hashed keys
- Rate limiting per key with tiered limits
- Usage metering and billing via Stripe
- REST endpoints at `/api/v1/data/*`
- `ApiKey`, `Subscription`, `ApiUsage` Prisma models

### Acceptance Criteria
- [ ] API keys can be created, rotated, and revoked
- [ ] Rate limiting enforced per tier (basic/pro/enterprise)
- [ ] Usage tracked per key per day
- [ ] Stripe subscription lifecycle works (create, upgrade, cancel)
- [ ] Endpoints return odds, line movement, CLV, +EV, consensus data
- [ ] API documentation auto-generated (Swagger/OpenAPI)

### Effort: L (3-4 weeks)
### Dependencies: ADR-006 (Licensing Investigation — must confirm GO)
ISSUE_EOF
)"

echo "  Creating: [Next] Privacy & Self-Hosting Marketing Page"
gh issue create --repo $REPO \
  --title "[Next] Privacy & Self-Hosting Marketing Page" \
  --label "enhancement,architecture,phase:next,growth" \
  --milestone "$NEXT_MILESTONE" \
  --body "$(cat <<'ISSUE_EOF'
## ADR-017: Privacy & Self-Hosting Marketing Page

Landing page and documentation for self-hosted deployment. Position privacy as a competitive feature.

**See full ADR:** [`docs/architecture/adr-017-privacy-self-hosting.md`](../docs/architecture/adr-017-privacy-self-hosting.md)

### Key Deliverables
- Privacy-focused marketing landing page (React component)
- One-command Docker deployment script
- Improved docker-compose.yml with health checks
- SELF-HOSTING.md comprehensive documentation

### Acceptance Criteria
- [ ] Landing page communicates "your data stays yours" value prop
- [ ] `docker-compose up` works with zero manual config
- [ ] Health checks configured for all services
- [ ] SELF-HOSTING.md covers setup, backup, updating, and troubleshooting
- [ ] Environment variable template with sensible defaults

### Effort: S (days)
### Dependencies: None
ISSUE_EOF
)"

echo ""

# --------------------------------------------------
# 6. Update EXISTING issues (#6, #7, #8) with milestone
# --------------------------------------------------
echo "--- Updating Existing Next Phase Issues ---"

echo "  Updating Issue #6 (Sharp Money) — adding milestone + labels"
gh issue edit 6 --repo $REPO \
  --milestone "$NEXT_MILESTONE" \
  --add-label "architecture,phase:next,data-analytics,ai-mcp" 2>/dev/null || echo "    Warning: could not update #6"

echo "  Updating Issue #7 (Market Consensus) — adding milestone + labels"
gh issue edit 7 --repo $REPO \
  --milestone "$NEXT_MILESTONE" \
  --add-label "architecture,phase:next,data-analytics" 2>/dev/null || echo "    Warning: could not update #7"

echo "  Updating Issue #8 (Bookmaker Analytics) — adding milestone + labels"
gh issue edit 8 --repo $REPO \
  --milestone "$NEXT_MILESTONE" \
  --add-label "architecture,phase:next,data-analytics" 2>/dev/null || echo "    Warning: could not update #8"

echo ""

# --------------------------------------------------
# 7. Close Issue #3 (CLV Tracking — already implemented)
# --------------------------------------------------
echo "--- Closing Completed Issue ---"
echo "  Closing Issue #3 (CLV Tracking — already implemented)"
gh issue close 3 --repo $REPO --comment "CLV Tracking is fully implemented. Closing per roadmap audit (April 2026). See CLV service, closing line capture job, and CLV analytics page in the codebase." 2>/dev/null || echo "    Warning: could not close #3"

echo ""
echo "========================================"
echo "DONE! GitHub roadmap setup complete."
echo "========================================"
echo ""
echo "Summary:"
echo "  - 2 milestones created (Phase: Now, Phase: Next)"
echo "  - 8 labels created/verified"
echo "  - 11 new issues created with milestones"
echo "  - 5 existing issues (#4,#5,#6,#7,#8) updated with milestones"
echo "  - Issue #3 closed as completed"
echo ""
echo "Run 'gh issue list --repo $REPO --state open' to verify."
