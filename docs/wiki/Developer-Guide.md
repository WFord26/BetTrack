# Developer Guide

Complete guide for developers contributing to or extending BetTrack.

## Table of Contents

- [Development Environment](#development-environment)
- [Project Structure](#project-structure)
- [Contributing Workflow](#contributing-workflow)
- [Code Standards](#code-standards)
- [Testing Strategy](#testing-strategy)
- [Build & Release](#build--release)
- [Debugging](#debugging)
- [Common Tasks](#common-tasks)

---

## Development Environment

### Prerequisites

- **Git** - Version control
- **Python 3.11+** - MCP server development
- **Node.js 20+** - Dashboard development
- **PostgreSQL 15+** - Database
- **Docker** - Container testing (optional)
- **VS Code** - Recommended IDE

### Recommended VS Code Extensions

```json
{
  "recommendations": [
    "ms-python.python",
    "ms-python.vscode-pylance",
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "Prisma.prisma",
    "bradlc.vscode-tailwindcss",
    "formulahendry.auto-rename-tag"
  ]
}
```

### Clone Repository

```bash
git clone https://github.com/WFord26/BetTrack.git
cd BetTrack
```

---

## Project Structure

```
BetTrack/
├── mcp/                        # MCP Server (Python)
│   ├── sports_mcp_server.py    # Main server
│   ├── dashboard_mcp_server.py # Dashboard integration server
│   ├── sports_api/             # API handlers
│   ├── releases/               # Built MCPB packages
│   └── tests/                  # Tests (TODO)
├── dashboard/                  # Web Dashboard
│   ├── backend/                # Node.js + TypeScript
│   │   ├── src/
│   │   │   ├── routes/         # Express routes
│   │   │   ├── services/       # Business logic
│   │   │   ├── jobs/           # Cron jobs
│   │   │   └── middleware/     # Express middleware
│   │   ├── prisma/             # Database schema
│   │   └── tests/              # Jest tests
│   └── frontend/               # React + Vite
│       ├── src/
│       │   ├── components/     # React components
│       │   ├── store/          # Redux store
│       │   ├── hooks/          # Custom hooks
│       │   └── pages/          # Page components
│       └── tests/              # Vitest tests
├── scripts/                    # Build scripts
│   ├── build.ps1               # Main build script
│   └── docker-build.ps1        # Docker builds
├── docs/                       # Documentation
│   ├── wiki/                   # GitHub wiki pages
│   └── *.md                    # Various docs
└── .github/                    # GitHub Actions
    ├── workflows/              # CI/CD pipelines
    └── copilot-instructions.md # AI agent guide
```

---

## Contributing Workflow

### 1. Fork & Branch

```bash
# Fork repository on GitHub

# Clone your fork
git clone https://github.com/YOUR_USERNAME/BetTrack.git
cd BetTrack

# Add upstream remote
git remote add upstream https://github.com/WFord26/BetTrack.git

# Create feature branch
git checkout -b feature/your-feature-name
```

### 2. Make Changes

Follow the [Code Standards](#code-standards) section below.

### 3. Test Changes

```bash
# MCP Server (manual testing via Claude)
python mcp/sports_mcp_server.py

# Backend tests
cd dashboard/backend
npm test

# Frontend tests
cd dashboard/frontend
npm test
```

### 4. Build & Verify

```bash
# Build MCP package
cd scripts
.\build.ps1 -VersionBump patch

# Build dashboard
.\build.ps1 -Dashboard -BumpBackend -BumpFrontend
```

**CRITICAL**: Always build before pushing to catch errors!

### 5. Commit & Push

```bash
# Stage changes
git add .

# Commit with descriptive message
git commit -m "feat: add player prop filtering to odds API"

# Push to your fork
git push origin feature/your-feature-name
```

### 6. Create Pull Request

1. Go to GitHub and create PR from your fork
2. Fill out PR template
3. Link related issues
4. Wait for CI/CD checks
5. Address review comments

---

## Code Standards

### Python (MCP Server)

**Style Guide**: PEP 8

```python
# Good
async def get_odds(sport: str, markets: str = "h2h") -> dict:
    """
    Fetch betting odds for a sport.
    
    Args:
        sport: Sport key (e.g., "basketball_nba")
        markets: Comma-separated markets (default: "h2h")
    
    Returns:
        dict: {"success": bool, "data": [...], "error": str}
    """
    try:
        result = await odds_handler.get_odds(sport, markets)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}
```

**Key Points**:
- Use type hints for all function parameters
- Document functions with docstrings
- Always return dict with `{"success": bool, ...}` structure
- Use async/await for all API calls
- Handle exceptions gracefully

### TypeScript (Backend)

**Style Guide**: Airbnb TypeScript

```typescript
// Good
export class GameService {
  private prisma: PrismaClient;
  
  constructor() {
    this.prisma = new PrismaClient();
  }
  
  /**
   * Find games with timezone-aware date filtering
   */
  async findGames(filters: GameFilters): Promise<Game[]> {
    const { sport, startDate, endDate } = filters;
    
    return this.prisma.game.findMany({
      where: {
        sport,
        commenceTime: {
          gte: startDate,
          lt: endDate,
        },
      },
      include: {
        homeTeam: true,
        awayTeam: true,
      },
    });
  }
}
```

**Key Points**:
- Use TypeScript strict mode
- Define interfaces for all data structures
- Use service layer pattern (separate business logic)
- Document public methods with JSDoc
- Use async/await, avoid callbacks
- Handle errors with try/catch

### React (Frontend)

**Style Guide**: React + Hooks

```tsx
// Good
interface GameCardProps {
  game: Game;
  onBetClick?: (bet: BetData) => void;
}

export function GameCard({ game, onBetClick }: GameCardProps) {
  const dispatch = useDispatch();
  const [isExpanded, setIsExpanded] = useState(false);
  
  const handleAddBet = useCallback((betType: string, odds: number) => {
    dispatch(addBet({ gameId: game.id, betType, odds }));
    onBetClick?.({ gameId: game.id, betType, odds });
  }, [dispatch, game.id, onBetClick]);
  
  return (
    <div className="card">
      {/* Component JSX */}
    </div>
  );
}
```

**Key Points**:
- Use functional components with hooks
- Define TypeScript interfaces for props
- Use `useCallback` for event handlers
- Prefer named exports over default exports
- Use Tailwind CSS classes, avoid inline styles
- Keep components focused (single responsibility)

### Git Commits

**Convention**: Conventional Commits

```bash
# Format
<type>(<scope>): <subject>

# Types
feat:     New feature
fix:      Bug fix
docs:     Documentation only
style:    Formatting, missing semicolons
refactor: Code restructuring
test:     Adding tests
chore:    Build process, dependencies

# Examples
feat(mcp): add player props filtering
fix(backend): resolve timezone calculation bug
docs(wiki): update installation guide
chore(deps): upgrade Prisma to 5.8.0
```

---

## Testing Strategy

### MCP Server Tests (Planned)

```bash
# Structure
mcp/tests/
├── test_odds_api_handler.py
├── test_espn_api_handler.py
├── test_formatters.py
└── test_team_reference.py

# Run tests (when implemented)
cd mcp
pytest tests/ -v
```

### Backend Tests (Jest)

```bash
cd dashboard/backend

# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

**Example Test**:
```typescript
// tests/services/game.service.test.ts
import { GameService } from '../../src/services/game.service';

describe('GameService', () => {
  let service: GameService;
  
  beforeEach(() => {
    service = new GameService();
  });
  
  describe('findGames', () => {
    it('should return games for specified sport', async () => {
      const games = await service.findGames({
        sport: 'basketball_nba',
      });
      
      expect(games).toBeDefined();
      expect(games.every(g => g.sport === 'basketball_nba')).toBe(true);
    });
  });
});
```

### Frontend Tests (Vitest)

```bash
cd dashboard/frontend

# Run tests
npm test

# Watch mode
npm run test:watch

# UI mode
npm run test:ui
```

**Example Test**:
```typescript
// tests/components/GameCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { GameCard } from '../../src/components/GameCard';

describe('GameCard', () => {
  const mockGame = {
    id: '1',
    homeTeam: 'Lakers',
    awayTeam: 'Celtics',
    homeOdds: -150,
    awayOdds: 130,
  };
  
  it('renders team names', () => {
    render(<GameCard game={mockGame} />);
    expect(screen.getByText('Lakers')).toBeInTheDocument();
    expect(screen.getByText('Celtics')).toBeInTheDocument();
  });
  
  it('calls onBetClick when odds button clicked', () => {
    const handleBetClick = jest.fn();
    render(<GameCard game={mockGame} onBetClick={handleBetClick} />);
    
    fireEvent.click(screen.getByText('-150'));
    expect(handleBetClick).toHaveBeenCalledWith({
      gameId: '1',
      team: 'Lakers',
      odds: -150,
    });
  });
});
```

---

## Build & Release

### Local Builds

```powershell
cd scripts

# MCP server only
.\build.ps1 -VersionBump patch

# Dashboard only
.\build.ps1 -Dashboard -BumpBackend -BumpFrontend

# Everything
.\build.ps1 -Dashboard -VersionBump patch -BumpBackend -BumpFrontend

# Beta build (testing)
.\build.ps1 -Beta
```

### Release Process

```powershell
# Full release (bumps version, creates GitHub release)
.\build.ps1 -VersionBump minor -Release

# What happens:
# 1. Version bumped in manifest.json and package.json
# 2. Git tag created (e.g., v0.2.0)
# 3. MCPB package built
# 4. GitHub release created with changelog
# 5. Tag pushed to GitHub
```

### Docker Builds

```powershell
.\docker-build.ps1 -Version "2026.01.12" -Backend -Frontend -Push

# Builds:
# - ghcr.io/wford26/bettrack-backend:2026.01.12
# - ghcr.io/wford26/bettrack-frontend:2026.01.12
# - Both tagged as :latest
```

---

## Debugging

### MCP Server Debugging

**VS Code Launch Configuration** (`.vscode/launch.json`):
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "MCP Server",
      "type": "python",
      "request": "launch",
      "program": "${workspaceFolder}/mcp/sports_mcp_server.py",
      "console": "integratedTerminal",
      "env": {
        "ODDS_API_KEY": "your_key_here"
      }
    }
  ]
}
```

**Logging**:
```python
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

logger.debug(f"Fetching odds for {sport}")
```

### Backend Debugging

**VS Code Configuration**:
```json
{
  "name": "Backend (Node)",
  "type": "node",
  "request": "launch",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "dev"],
  "cwd": "${workspaceFolder}/dashboard/backend",
  "console": "integratedTerminal"
}
```

**Logging** (Winston):
```typescript
import { logger } from './utils/logger';

logger.info('Starting odds sync', { sport: 'basketball_nba' });
logger.error('API request failed', { error: err.message });
```

### Frontend Debugging

**Browser DevTools**:
- **Console**: Check for errors and logs
- **Network**: Monitor API requests
- **Redux DevTools**: Inspect state changes
- **React DevTools**: Component hierarchy

**Console Logging**:
```typescript
console.log('[GameCard] Rendering with game:', game);
console.error('[API] Request failed:', error);
```

### Database Debugging

```bash
# Prisma Studio (visual database browser)
cd dashboard/backend
npm run prisma:studio

# Raw SQL queries
npm run prisma:studio
# Or use psql:
psql -U postgres -d bettrack
```

---

## Common Tasks

### Adding a New MCP Tool

**File**: `mcp/sports_mcp_server.py`

```python
@mcp.tool()
async def get_team_roster(team_name: str, sport: str) -> dict:
    """
    Get roster for a team.
    
    Args:
        team_name: Team name (e.g., "Lakers")
        sport: Sport key (e.g., "basketball_nba")
    
    Returns:
        {"success": bool, "data": [...], "error": str}
    """
    try:
        team_id = find_team_id(team_name, sport)
        if not team_id:
            return {"success": False, "error": "Team not found"}
        
        roster = await espn_handler.get_roster(sport, team_id)
        return {"success": True, "data": roster}
    except Exception as e:
        return {"success": False, "error": str(e)}
```

### Adding a Backend API Route

**File**: `dashboard/backend/src/routes/teams.routes.ts`

```typescript
import { Router } from 'express';
import { TeamService } from '../services/team.service';

const router = Router();
const teamService = new TeamService();

router.get('/:id', async (req, res, next) => {
  try {
    const team = await teamService.findById(req.params.id);
    
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    res.json(team);
  } catch (error) {
    next(error);
  }
});

export default router;
```

**Register in `app.ts`**:
```typescript
import teamsRoutes from './routes/teams.routes';
app.use('/api/teams', teamsRoutes);
```

### Adding a React Component

**File**: `dashboard/frontend/src/components/TeamCard.tsx`

```tsx
import { Team } from '../types';

interface TeamCardProps {
  team: Team;
}

export function TeamCard({ team }: TeamCardProps) {
  return (
    <div className="card">
      <img src={team.logoUrl} alt={team.name} className="w-16 h-16" />
      <h3 className="font-bold text-lg">{team.name}</h3>
      <p className="text-gray-600">{team.abbr}</p>
    </div>
  );
}
```

### Adding a Database Model

**File**: `dashboard/backend/prisma/schema.prisma`

```prisma
model Player {
  id        String   @id @default(uuid())
  name      String
  position  String
  teamId    String
  team      Team     @relation(fields: [teamId], references: [id])
  stats     Json?
  
  @@index([teamId])
  @@map("players")
}

model Team {
  id      String   @id @default(uuid())
  name    String
  players Player[]
}
```

**Create Migration**:
```bash
npm run prisma:migrate -- --name add_players
npm run prisma:generate
```

### Updating Changelog

**Location**: Component-specific changelogs

```markdown
## [Unreleased]

### Added
- New player roster API endpoint (#123)
- Team card component with logo display
- Player props filtering in odds API

### Changed
- Updated odds sync to run every 5 minutes (was 10)
- Improved timezone handling in game queries

### Fixed
- Fixed bet slip not clearing after submission (#125)
- Resolved duplicate team entries in database
```

---

## Performance Optimization

### MCP Server

```python
# Use async/await
async def fetch_multiple_sports():
    results = await asyncio.gather(
        odds_handler.get_odds("basketball_nba"),
        odds_handler.get_odds("americanfootball_nfl"),
        odds_handler.get_odds("icehockey_nhl")
    )
    return results

# Reuse sessions
class OddsAPIHandler:
    async def _get_session(self):
        if self._session is None:
            self._session = aiohttp.ClientSession()
        return self._session
```

### Backend

```typescript
// Use database indexes
@@index([sport, commenceTime])

// Batch database operations
await prisma.bet.createMany({ data: bets });

// Select only needed fields
const games = await prisma.game.findMany({
  select: { id: true, homeTeam: true, awayTeam: true },
});
```

### Frontend

```tsx
// Use React.memo for expensive components
export const GameCard = React.memo(({ game }) => {
  // ...
});

// Use useCallback for event handlers
const handleClick = useCallback(() => {
  // ...
}, [deps]);

// Lazy load heavy components
const OddsChart = lazy(() => import('./OddsChart'));
```

---

## Resources

### Documentation
- [FastMCP Docs](https://github.com/jlowin/fastmcp)
- [Prisma Docs](https://www.prisma.io/docs)
- [Redux Toolkit](https://redux-toolkit.js.org/)
- [Recharts](https://recharts.org/)

### Community
- [GitHub Issues](https://github.com/WFord26/BetTrack/issues)
- [GitHub Discussions](https://github.com/WFord26/BetTrack/discussions)

### Related Guides
- [MCP Server Guide](MCP-Server-Guide)
- [Backend Guide](Backend-Guide)
- [Frontend Guide](Frontend-Guide)
- [Database Guide](Database-Guide)

---

**Happy coding!** 🚀
