# Issue Templates - Advanced Analytics Features

This directory contains GitHub issue templates for the Advanced Analytics Rollout project.

## 📁 Templates Overview

### Epic Tracking
- **epic-advanced-analytics-rollout.md**: Master tracking issue for all 8 features across 3 phases

### Phase 1: Core Analytics (Foundation)
- **phase1-clv-tracking.md**: Closing Line Value tracking (6 days)
- **phase1-bookmaker-disagreement.md**: Odds discrepancy detection (6 days)
- **phase1-line-movement.md**: Line movement tracking and visualization (8 days)

### Phase 2: Market Intelligence (Intermediate)
- **phase2-sharp-vs-public.md**: Professional vs recreational betting indicators (8 days)
- **phase2-market-consensus.md**: True market odds calculation (6 days)
- **phase2-bookmaker-analytics.md**: Bookmaker behavior profiling (8 days)

### Phase 3: Advanced Features (Professional)
- **phase3-arbitrage-detection.md**: Real-time arbitrage opportunity scanning (18 days)
- **phase3-bet-correlation-analysis.md**: Parlay correlation detection (22 days)

## 🚀 Quick Start

**See**: [../.github/ISSUE_QUICK_START.md](../ISSUE_QUICK_START.md) for detailed instructions on:
- How to create issues from templates
- Setting up project boards
- Milestone planning
- Sprint organization
- Progress tracking

## 📊 Implementation Timeline

```
┌─────────────────────────────────────────────────────────────────┐
│ Phase 1: Core Analytics (20 days)                               │
├─────────────────────────────────────────────────────────────────┤
│ ├─ CLV Tracking (6 days)                                        │
│ ├─ Bookmaker Disagreement (6 days)                             │
│ └─ Line Movement (8 days)                                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Phase 2: Market Intelligence (22 days)                          │
├─────────────────────────────────────────────────────────────────┤
│ ├─ Sharp vs Public Money (8 days)                              │
│ ├─ Market Consensus (6 days)                                   │
│ └─ Bookmaker Analytics (8 days)                                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Phase 3: Advanced Features (40 days)                            │
├─────────────────────────────────────────────────────────────────┤
│ ├─ Arbitrage Detection (18 days)                               │
│ └─ Bet Correlation Analysis (22 days)                          │
└─────────────────────────────────────────────────────────────────┘

Total: 82 days (~3-4 months)
```

## 🎯 Feature Priorities

### High Priority (Start First)
1. **CLV Tracking** - Foundation for all other features
   - Most user value
   - Simplest implementation
   - Required by other features

### Medium Priority (Phase 1-2)
2. **Line Movement** - Visual appeal, sharp money signals
3. **Bookmaker Disagreement** - Automated value detection
4. **Sharp vs Public** - Professional betting insights
5. **Market Consensus** - True price discovery
6. **Bookmaker Analytics** - Account management

### Lower Priority (Phase 3)
7. **Arbitrage Detection** - Complex but high value
8. **Bet Correlation** - Educational + risk management

## 📦 What's Included in Each Template

Every template includes:
- ✅ **Overview**: Feature description
- ✅ **Business Value**: Why it matters
- ✅ **Technical Requirements**:
  - Database schema (Prisma models)
  - Backend services and algorithms
  - API endpoints with full specs
  - Frontend components with UI mockups
- ✅ **Acceptance Criteria**: Detailed checklist
- ✅ **Dependencies**: Internal and external
- ✅ **Estimated Effort**: Realistic time estimates
- ✅ **Success Metrics**: Measurable KPIs
- ✅ **Future Enhancements**: Extensibility

## 🛠️ Database Schema Changes

### Already Completed ✅
- `apiSportsTeamId` on Team model
- `apiSportsPlayerId` on Player model
- `apiSportsGameId`, `apiSportsLeagueId`, `season`, `seasonType` on Game model
- Migration: `add_api_sports_ids` applied successfully

### To Be Added (Per Feature)
- **Phase 1**: `CLVSnapshot`, `LineMovement`, `BookmakerDisagreement`
- **Phase 2**: `SharpMoneyIndicator`, `MarketConsensus`, `BookmakerProfile`
- **Phase 3**: `ArbitrageOpportunity`, `BetCorrelation`, `ParlayAnalysis`

## 🔗 Related Documentation

- **Planning Summary**: [../../docs/ANALYTICS-IMPLEMENTATION-SUMMARY.md](../../docs/ANALYTICS-IMPLEMENTATION-SUMMARY.md)
- **Quick Start Guide**: [../ISSUE_QUICK_START.md](../ISSUE_QUICK_START.md)
- **API Documentation**: [../../docs/wiki/API-DOCUMENTATION.md](../../docs/wiki/API-DOCUMENTATION.md)
- **Database Guide**: [../../docs/wiki/Database-Guide.md](../../docs/wiki/Database-Guide.md)
- **Root Changelog**: [../../CHANGELOG.md](../../CHANGELOG.md)

## 💡 Usage Tips

1. **Create Epic First**: Provides context for all feature issues
2. **Follow Dependency Order**: CLV → Disagreement/Movement → Phase 2 → Phase 3
3. **One Sprint at a Time**: Don't create all issues at once if using sprints
4. **Update Epic Progress**: Keep progress percentages current
5. **Link Pull Requests**: Use "Closes #123" in PR descriptions
6. **Check Acceptance Criteria**: Use as development checklist

## 📈 Expected Outcomes

### User Experience
- 📊 Better betting decisions through data
- 🎓 Educational content on betting strategy
- 💰 Improved ROI (3-5% win rate increase)
- 🎯 Competitive advantage over other platforms

### Business Metrics
- 📈 +40% daily active users
- ⏱️ +25% session duration
- 🎯 +30% 30-day retention
- 💵 +50% premium subscriptions

### Competitive Position
- 🏆 Feature parity with DraftKings, FanDuel
- 🚀 Unique features: CLV, arbitrage, correlation
- 🎓 Best-in-class educational content

## 🚦 Getting Started

### Step 1: Read the Documentation
```bash
# Planning summary
cat docs/ANALYTICS-IMPLEMENTATION-SUMMARY.md

# Quick start guide
cat .github/ISSUE_QUICK_START.md
```

### Step 2: Create Epic Issue
- Use `epic-advanced-analytics-rollout.md` template
- Note the issue number (e.g., #10)

### Step 3: Create Phase 1 Issues
- Start with `phase1-clv-tracking.md`
- Then `phase1-bookmaker-disagreement.md`
- Then `phase1-line-movement.md`

### Step 4: Update Epic
- Replace `#TBD` with actual issue numbers
- Link all Phase 1, 2, 3 issues

### Step 5: Start Sprint 1
- Focus on CLV tracking only
- Break into 2-week sprint tasks
- Daily standups and weekly updates

## ❓ Questions?

- Check [ISSUE_QUICK_START.md](../ISSUE_QUICK_START.md)
- Review [ANALYTICS-IMPLEMENTATION-SUMMARY.md](../../docs/ANALYTICS-IMPLEMENTATION-SUMMARY.md)
- Comment on the epic issue
- Tag team members for clarification

---

**Created**: January 15, 2026  
**Status**: Ready for implementation  
**Total Features**: 8  
**Total Phases**: 3  
**Estimated Duration**: 82 days
