# GitHub Issues Quick Start Guide

## Overview
This guide explains how to use the advanced analytics issue templates to implement the 8 features across 3 phases.

## Issue Templates Location
`.github/ISSUE_TEMPLATE/`

## How to Create Issues from Templates

### Option 1: GitHub Web UI
1. Navigate to repository: `https://github.com/YOUR_USERNAME/Sports-Odds-MCP`
2. Click **"Issues"** tab
3. Click **"New Issue"** button
4. Select template from list:
   - `[Phase 1] CLV Tracking`
   - `[Phase 1] Bookmaker Disagreement Detection`
   - `[Phase 1] Line Movement Tracking`
   - `[Phase 2] Sharp vs Public Money Indicators`
   - `[Phase 2] Market Consensus & Deviations`
   - `[Phase 2] Bookmaker Analytics`
   - `[Phase 3] Arbitrage Detection`
   - `[Phase 3] Bet Correlation Analysis`
   - `[EPIC] Advanced Analytics Rollout`
5. Click **"Get started"**
6. Review pre-filled content
7. Update `#TBD` references with actual issue numbers
8. Assign team members
9. Add to project board (optional)
10. Click **"Submit new issue"**

### Option 2: GitHub CLI
```bash
# Install GitHub CLI (if not already installed)
# Windows: winget install --id GitHub.cli
# macOS: brew install gh

# Authenticate
gh auth login

# Create issues from templates
gh issue create --template phase1-clv-tracking.md --label "enhancement,phase-1,analytics"
gh issue create --template phase1-bookmaker-disagreement.md --label "enhancement,phase-1,analytics"
gh issue create --template phase1-line-movement.md --label "enhancement,phase-1,analytics"
gh issue create --template phase2-sharp-vs-public.md --label "enhancement,phase-2,analytics"
gh issue create --template phase2-market-consensus.md --label "enhancement,phase-2,analytics"
gh issue create --template phase2-bookmaker-analytics.md --label "enhancement,phase-2,analytics"
gh issue create --template phase3-arbitrage-detection.md --label "enhancement,phase-3,analytics,advanced"
gh issue create --template phase3-bet-correlation-analysis.md --label "enhancement,phase-3,analytics,advanced"
gh issue create --template epic-advanced-analytics-rollout.md --label "epic,analytics,enhancement"
```

### Option 3: Manual Creation
1. Copy template file content
2. Create new issue
3. Paste content into description
4. Add labels, assignees, project
5. Submit

## Recommended Issue Creation Order

### Step 1: Create Epic (Master Tracking Issue)
- **Template**: `epic-advanced-analytics-rollout.md`
- **Why First**: Provides context and links for all feature issues
- **Note Issue Number**: You'll reference this in all feature issues

### Step 2: Create Phase 1 Issues
1. `phase1-clv-tracking.md` (Highest priority - foundation)
2. `phase1-bookmaker-disagreement.md`
3. `phase1-line-movement.md`

### Step 3: Create Phase 2 Issues
4. `phase2-sharp-vs-public.md`
5. `phase2-market-consensus.md`
6. `phase2-bookmaker-analytics.md`

### Step 4: Create Phase 3 Issues
7. `phase3-arbitrage-detection.md`
8. `phase3-bet-correlation-analysis.md`

### Step 5: Update Epic with Issue Numbers
- Edit epic issue
- Replace `#TBD` with actual issue numbers
- Example: `- [ ] #15 - CLV Tracking`

## Labels to Use

### Priority Labels
- `priority-critical` - Blocking other work
- `priority-high` - Start soon
- `priority-medium` - Standard priority
- `priority-low` - Nice to have

### Phase Labels (Pre-filled in templates)
- `phase-1` - Core Analytics
- `phase-2` - Market Intelligence
- `phase-3` - Advanced Features

### Category Labels (Pre-filled in templates)
- `enhancement` - New feature
- `analytics` - Analytics-related
- `advanced` - Advanced/complex feature
- `epic` - Master tracking issue

### Status Labels (Add as work progresses)
- `status-planning` - Requirements gathering
- `status-in-progress` - Active development
- `status-review` - Code review or testing
- `status-blocked` - Waiting on dependency
- `status-done` - Completed

## Project Board Setup (Optional)

### Create Project Board
1. Go to repository → **"Projects"** tab
2. Click **"New project"**
3. Name: "Advanced Analytics Rollout"
4. Template: "Board" (Kanban style)

### Columns
- **Backlog**: All created issues
- **Sprint Ready**: Prioritized for current sprint
- **In Progress**: Actively being worked on
- **Review/QA**: Code review or testing
- **Done**: Completed and merged

### Add Issues to Board
1. Click **"Add cards"**
2. Select all created issues
3. Drag to appropriate column

## Milestones (Recommended)

### Create Milestones
1. Go to repository → **"Issues"** → **"Milestones"**
2. Click **"New milestone"**

**Milestone 1: Phase 1 - Core Analytics**
- Title: "Phase 1 - Core Analytics"
- Due date: +20 days from start
- Description: "CLV tracking, line movement, bookmaker disagreement"
- Issues: #2, #3, #4 (Phase 1 issues)

**Milestone 2: Phase 2 - Market Intelligence**
- Title: "Phase 2 - Market Intelligence"
- Due date: +42 days from start
- Description: "Sharp money, consensus, bookmaker analytics"
- Issues: #5, #6, #7 (Phase 2 issues)

**Milestone 3: Phase 3 - Advanced Features**
- Title: "Phase 3 - Advanced Features"
- Due date: +82 days from start
- Description: "Arbitrage detection, bet correlation"
- Issues: #8, #9 (Phase 3 issues)

### Assign Issues to Milestones
1. Open each issue
2. Right sidebar → **"Milestone"**
3. Select appropriate milestone

## Assignees

### How to Assign
1. Open issue
2. Right sidebar → **"Assignees"**
3. Select team member(s)

### Recommended Assignments
- **Backend Developer**: All issues (API, services, algorithms)
- **Frontend Developer**: All issues (UI components, charts)
- **QA Engineer**: Assigned during review phase
- **Product Manager**: Epic issue (tracking)

## Issue Dependencies

### Document Dependencies
Add to issue description:
```markdown
## Dependencies
- Depends on: #15 (CLV Tracking must be completed first)
- Blocks: #18 (Arbitrage detection needs this feature)
- Related to: #16 (Uses similar algorithm)
```

### Dependency Order
```
Phase 1 Foundation:
  #2 (CLV) → [No dependencies]
  #3 (Disagreement) → Depends on #2 (uses closing lines)
  #4 (Line Movement) → Depends on #2 (uses historical odds)

Phase 2 Building:
  #5 (Sharp Money) → Depends on #4 (line movement data)
  #6 (Consensus) → Depends on #3 (disagreement data)
  #7 (Bookmaker Analytics) → Depends on #2, #3, #4

Phase 3 Advanced:
  #8 (Arbitrage) → Depends on #6 (consensus data)
  #9 (Correlation) → Depends on #2, #6 (CLV + consensus)
```

## Sprint Planning

### Sprint 1 (2 weeks) - CLV Foundation
- **Issues**: #2 (CLV Tracking)
- **Goal**: Implement closing line capture and basic CLV calculation
- **Tasks**:
  - [ ] Create `CLVSnapshot` database model
  - [ ] Implement closing line capture service
  - [ ] Build CLV calculation algorithm
  - [ ] Create API endpoints
  - [ ] Design dashboard component
  - [ ] Write unit tests

### Sprint 2 (2 weeks) - CLV Completion + Line Movement
- **Issues**: #2 (completion), #4 (Line Movement)
- **Goal**: Finish CLV features, start line movement tracking
- **Tasks**:
  - [ ] CLV dashboard polish and charts
  - [ ] Line movement database model
  - [ ] Start line movement API

### Sprint 3 (2 weeks) - Disagreement Detection
- **Issues**: #3 (Bookmaker Disagreement), #4 (continuation)
- **Goal**: Complete line movement, implement disagreement detection
- **Tasks**:
  - [ ] Line movement charts and alerts
  - [ ] Disagreement detection algorithm
  - [ ] Disagreement dashboard

### Sprints 4-14
- Continue with Phase 2 and Phase 3 features
- Refer to epic issue for full timeline

## Tracking Progress

### Update Issues Regularly
- Add comments with progress updates
- Check off acceptance criteria checkboxes
- Update status labels
- Link to pull requests

### Epic Issue Tracking
- Update progress percentages in epic:
  - "Phase 1: 2/3 complete (67%)"
  - "Overall: 5/8 complete (63%)"
- Update timeline if delays occur
- Document blockers and risks

### Pull Request Linking
When creating PRs:
```
Closes #15  # Automatically closes issue when PR merged
Part of #15  # Links to issue without closing
```

## Communication

### Issue Comments
- Use `@username` to mention team members
- Add screenshots of progress
- Document decisions and changes
- Ask questions for clarification

### Code Reviews
- Request reviews from assignees
- Use PR templates (create `.github/pull_request_template.md`)
- Link to related issues

### Status Updates
Weekly update template:
```markdown
## Week of [Date]

### Completed
- ✅ CLV database model created
- ✅ API endpoints implemented

### In Progress
- 🔄 Frontend dashboard component

### Blocked
- ⚠️ Waiting on API-Sports data schema

### Next Week
- Dashboard component completion
- Unit testing
```

## Closing Issues

### When to Close
- All acceptance criteria checked off
- Code merged to main branch
- Tests passing
- Deployed to production (or staging)
- Documentation updated

### How to Close
1. Add final comment: "Completed in #123 (PR)"
2. Check all checkboxes in description
3. Click **"Close issue"**
4. Update epic progress tracking

## Quick Commands

### List All Open Issues
```bash
gh issue list --label "analytics"
```

### View Issue Details
```bash
gh issue view 15
```

### Update Issue
```bash
gh issue edit 15 --add-label "status-in-progress" --add-assignee username
```

### Close Issue
```bash
gh issue close 15 --comment "Completed in PR #123"
```

## Best Practices

1. **Start with Epic**: Create epic issue first for context
2. **One Feature Per Issue**: Don't combine multiple features
3. **Update Regularly**: Add comments weekly (minimum)
4. **Link PRs**: Always reference issue number in PR
5. **Check Acceptance Criteria**: Use as development checklist
6. **Document Decisions**: Record why you chose certain approaches
7. **Test Before Closing**: Verify all acceptance criteria met
8. **Update Documentation**: Don't forget to update README, wiki, API docs

## Templates Summary

| Template | Priority | Dependencies | Effort | Phase |
|----------|----------|--------------|--------|-------|
| CLV Tracking | Highest | None | 6 days | 1 |
| Bookmaker Disagreement | High | CLV | 6 days | 1 |
| Line Movement | High | CLV | 8 days | 1 |
| Sharp vs Public | Medium | Line Movement | 8 days | 2 |
| Market Consensus | Medium | Disagreement | 6 days | 2 |
| Bookmaker Analytics | Medium | All Phase 1 | 8 days | 2 |
| Arbitrage Detection | Low | Consensus | 18 days | 3 |
| Bet Correlation | Low | CLV, Consensus | 22 days | 3 |

## Resources

- **Documentation**: `docs/ANALYTICS-IMPLEMENTATION-SUMMARY.md`
- **Database Schema**: `dashboard/backend/prisma/schema.prisma`
- **API Documentation**: `docs/wiki/API-DOCUMENTATION.md`
- **Database Guide**: `docs/wiki/Database-Guide.md`

## Questions?

If templates are unclear or you need more detail:
1. Check `docs/ANALYTICS-IMPLEMENTATION-SUMMARY.md`
2. Review the epic issue for context
3. Comment on the specific issue
4. Tag relevant team members

---

**Last Updated**: January 15, 2026  
**Version**: 1.0  
**Status**: Ready for implementation
