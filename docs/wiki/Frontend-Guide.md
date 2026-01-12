# Frontend Guide

Complete guide to the BetTrack dashboard frontend - React, Redux, components, and features.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [State Management](#state-management)
- [Components](#components)
- [Charts & Visualization](#charts--visualization)
- [API Integration](#api-integration)
- [Styling](#styling)
- [Development](#development)
- [Building & Deployment](#building--deployment)

---

## Architecture Overview

The BetTrack frontend is a modern React SPA (Single Page Application) built with Vite for fast development and optimized production builds.

### Key Features

- ⚛️ **React 18** with hooks and functional components
- 🔄 **Redux Toolkit** for state management
- 📊 **Recharts** for odds movement visualization
- 🎨 **Tailwind CSS** for utility-first styling
- 🚀 **Vite** for lightning-fast HMR
- 🧪 **Vitest** for unit testing
- 📱 **Responsive design** (mobile-first approach)

---

## Technology Stack

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.21.0",
    "@reduxjs/toolkit": "^2.0.1",
    "react-redux": "^9.0.4",
    "recharts": "^2.10.3",
    "date-fns": "^3.0.6",
    "axios": "^1.6.5"
  },
  "devDependencies": {
    "vite": "^5.0.10",
    "vitest": "^1.1.0",
    "@vitejs/plugin-react": "^4.2.1",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32"
  }
}
```

---

## Project Structure

```
dashboard/frontend/
├── src/
│   ├── components/          # React components
│   │   ├── BetSlip.jsx      # Floating bet slip widget
│   │   ├── GameCard.jsx     # Individual game display
│   │   ├── OddsTable.jsx    # Odds comparison table
│   │   └── LineChart.jsx    # Line movement chart
│   ├── store/               # Redux store and slices
│   │   ├── store.js         # Store configuration
│   │   └── betSlipSlice.js  # Bet slip state management
│   ├── hooks/               # Custom React hooks
│   │   ├── useGames.js      # Fetch games from API
│   │   ├── useOdds.js       # Fetch odds data
│   │   └── useTimezone.js   # Timezone utilities
│   ├── utils/               # Utility functions
│   │   ├── api.js           # Axios instance
│   │   ├── formatters.js    # Display formatters
│   │   └── calculations.js  # Odds calculations
│   ├── pages/               # Page components
│   │   ├── HomePage.jsx     # Main dashboard
│   │   ├── BetsPage.jsx     # Bet history
│   │   └── GamesPage.jsx    # Game browser
│   ├── App.jsx              # Root component
│   ├── main.jsx             # Entry point
│   └── index.css            # Global styles
├── public/                  # Static assets
├── tests/                   # Test files
├── vite.config.js          # Vite configuration
├── tailwind.config.js      # Tailwind configuration
└── package.json
```

---

## State Management

### Redux Toolkit Setup

**Store Configuration** (`src/store/store.js`):
```javascript
import { configureStore } from '@reduxjs/toolkit';
import betSlipReducer from './betSlipSlice';

export const store = configureStore({
  reducer: {
    betSlip: betSlipReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore date objects in actions/state
        ignoredActions: ['betSlip/addBet'],
        ignoredPaths: ['betSlip.bets'],
      },
    }),
});
```

### Bet Slip Slice

**State Structure** (`src/store/betSlipSlice.js`):
```javascript
import { createSlice } from '@reduxjs/toolkit';

const betSlipSlice = createSlice({
  name: 'betSlip',
  initialState: {
    bets: [],           // Array of bet objects
    isOpen: false,      // Bet slip visibility
    totalStake: 0,      // Sum of all stakes
    potentialPayout: 0, // Calculated payout
  },
  reducers: {
    addBet: (state, action) => {
      const { gameId, betType, odds, team } = action.payload;
      // Prevent duplicates
      const exists = state.bets.find(
        bet => bet.gameId === gameId && bet.betType === betType
      );
      if (!exists) {
        state.bets.push({
          id: crypto.randomUUID(),
          gameId,
          betType,
          odds,
          team,
          stake: 0,
          addedAt: new Date().toISOString(),
        });
      }
    },
    removeBet: (state, action) => {
      state.bets = state.bets.filter(bet => bet.id !== action.payload);
    },
    updateStake: (state, action) => {
      const { id, stake } = action.payload;
      const bet = state.bets.find(bet => bet.id === id);
      if (bet) {
        bet.stake = parseFloat(stake) || 0;
      }
      // Recalculate totals
      state.totalStake = state.bets.reduce((sum, bet) => sum + bet.stake, 0);
      state.potentialPayout = state.bets.reduce(
        (sum, bet) => sum + calculatePayout(bet.stake, bet.odds),
        0
      );
    },
    clearBets: (state) => {
      state.bets = [];
      state.totalStake = 0;
      state.potentialPayout = 0;
    },
    toggleBetSlip: (state) => {
      state.isOpen = !state.isOpen;
    },
  },
});

export const { addBet, removeBet, updateStake, clearBets, toggleBetSlip } =
  betSlipSlice.actions;
export default betSlipSlice.reducer;
```

### Using Redux in Components

```javascript
import { useSelector, useDispatch } from 'react-redux';
import { addBet, updateStake } from '../store/betSlipSlice';

function GameCard({ game }) {
  const dispatch = useDispatch();
  const bets = useSelector(state => state.betSlip.bets);
  
  const handleAddBet = (betType, odds, team) => {
    dispatch(addBet({
      gameId: game.id,
      betType,
      odds,
      team,
    }));
  };
  
  return (
    <div>
      <button onClick={() => handleAddBet('moneyline', -150, game.homeTeam)}>
        {game.homeTeam} -150
      </button>
    </div>
  );
}
```

---

## Components

### GameCard Component

Displays individual game with odds and betting options.

```jsx
// src/components/GameCard.jsx
import { format } from 'date-fns';
import { useDispatch } from 'react-redux';
import { addBet } from '../store/betSlipSlice';

export function GameCard({ game }) {
  const dispatch = useDispatch();
  
  const handleBetClick = (betType, odds, team) => {
    dispatch(addBet({
      gameId: game.id,
      betType,
      odds,
      team,
    }));
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      {/* Game header */}
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-gray-500">
          {format(new Date(game.commenceTime), 'EEE, MMM d • h:mm a')}
        </div>
        <div className="text-xs text-gray-400">{game.sport}</div>
      </div>
      
      {/* Teams */}
      <div className="space-y-3">
        {/* Away team */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={game.awayTeamLogo} 
              alt={game.awayTeam}
              className="w-10 h-10"
            />
            <span className="font-semibold">{game.awayTeam}</span>
          </div>
          <button
            onClick={() => handleBetClick('moneyline', game.awayOdds, game.awayTeam)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {game.awayOdds > 0 ? '+' : ''}{game.awayOdds}
          </button>
        </div>
        
        {/* Home team */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={game.homeTeamLogo} 
              alt={game.homeTeam}
              className="w-10 h-10"
            />
            <span className="font-semibold">{game.homeTeam}</span>
          </div>
          <button
            onClick={() => handleBetClick('moneyline', game.homeOdds, game.homeTeam)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {game.homeOdds > 0 ? '+' : ''}{game.homeOdds}
          </button>
        </div>
      </div>
      
      {/* More odds button */}
      <button className="w-full mt-4 text-sm text-blue-600 hover:underline">
        View all odds →
      </button>
    </div>
  );
}
```

### BetSlip Component

Floating widget for managing bets before submission.

```jsx
// src/components/BetSlip.jsx
import { useSelector, useDispatch } from 'react-redux';
import { removeBet, updateStake, clearBets, toggleBetSlip } from '../store/betSlipSlice';
import { calculatePayout, calculateImpliedProbability } from '../utils/calculations';

export function BetSlip() {
  const dispatch = useDispatch();
  const { bets, isOpen, totalStake, potentialPayout } = useSelector(
    state => state.betSlip
  );
  
  if (!isOpen) {
    return (
      <button
        onClick={() => dispatch(toggleBetSlip())}
        className="fixed bottom-4 right-4 bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg"
      >
        Bet Slip ({bets.length})
      </button>
    );
  }
  
  return (
    <div className="fixed bottom-0 right-0 w-96 bg-white shadow-xl rounded-t-lg">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b">
        <h3 className="font-bold text-lg">Bet Slip ({bets.length})</h3>
        <button
          onClick={() => dispatch(toggleBetSlip())}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>
      
      {/* Bets list */}
      <div className="max-h-96 overflow-y-auto p-4 space-y-4">
        {bets.length === 0 ? (
          <p className="text-gray-500 text-center">No bets added yet</p>
        ) : (
          bets.map(bet => (
            <div key={bet.id} className="border rounded p-3">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-semibold">{bet.team}</div>
                  <div className="text-sm text-gray-500">{bet.betType}</div>
                </div>
                <button
                  onClick={() => dispatch(removeBet(bet.id))}
                  className="text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
              
              {/* Odds display */}
              <div className="text-sm mb-2">
                <span className="font-semibold">
                  {bet.odds > 0 ? '+' : ''}{bet.odds}
                </span>
                <span className="text-gray-500 ml-2">
                  ({calculateImpliedProbability(bet.odds).toFixed(1)}% probability)
                </span>
              </div>
              
              {/* Stake input */}
              <div>
                <label className="text-sm text-gray-600">Stake:</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={bet.stake || ''}
                  onChange={e => dispatch(updateStake({
                    id: bet.id,
                    stake: e.target.value
                  }))}
                  placeholder="Enter stake"
                  className="w-full border rounded px-3 py-2 mt-1"
                />
              </div>
              
              {/* Potential payout */}
              {bet.stake > 0 && (
                <div className="text-sm text-green-600 mt-2">
                  Potential win: ${calculatePayout(bet.stake, bet.odds).toFixed(2)}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      
      {/* Footer */}
      {bets.length > 0 && (
        <div className="border-t p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span>Total Stake:</span>
            <span className="font-semibold">${totalStake.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Potential Payout:</span>
            <span className="font-semibold text-green-600">
              ${potentialPayout.toFixed(2)}
            </span>
          </div>
          <button
            className="w-full bg-green-600 text-white py-3 rounded hover:bg-green-700"
            onClick={() => handlePlaceBets()}
          >
            Place Bets
          </button>
          <button
            onClick={() => dispatch(clearBets())}
            className="w-full text-sm text-gray-600 hover:text-gray-800"
          >
            Clear All
          </button>
        </div>
      )}
    </div>
  );
}
```

### LineChart Component

Visualizes odds movement over time using Recharts.

```jsx
// src/components/LineChart.jsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { format } from 'date-fns';

export function OddsLineChart({ data, bookmakers }) {
  // Transform data for Recharts
  const chartData = data.map(snapshot => ({
    timestamp: new Date(snapshot.timestamp).getTime(),
    ...Object.fromEntries(
      snapshot.bookmakers.map(bm => [bm.name, bm.price])
    ),
  }));
  
  return (
    <LineChart width={800} height={400} data={chartData}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis
        dataKey="timestamp"
        tickFormatter={timestamp => format(timestamp, 'HH:mm')}
        label={{ value: 'Time', position: 'insideBottom', offset: -5 }}
      />
      <YAxis
        label={{ value: 'Odds', angle: -90, position: 'insideLeft' }}
      />
      <Tooltip
        labelFormatter={timestamp => format(timestamp, 'MMM d, HH:mm')}
        formatter={(value, name) => [`${value > 0 ? '+' : ''}${value}`, name]}
      />
      <Legend />
      
      {bookmakers.map((bookmaker, index) => (
        <Line
          key={bookmaker}
          type="monotone"
          dataKey={bookmaker}
          stroke={COLORS[index % COLORS.length]}
          strokeWidth={2}
          dot={false}
        />
      ))}
    </LineChart>
  );
}

const COLORS = ['#2563eb', '#dc2626', '#059669', '#d97706', '#7c3aed'];
```

---

## API Integration

### Axios Instance

**Configuration** (`src/utils/api.js`):
```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  config => {
    // Add timezone offset to all requests
    const timezoneOffset = new Date().getTimezoneOffset();
    config.params = {
      ...config.params,
      timezoneOffset,
    };
    return config;
  },
  error => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default api;
```

### Custom Hooks

**Fetch Games** (`src/hooks/useGames.js`):
```javascript
import { useState, useEffect } from 'react';
import api from '../utils/api';

export function useGames(sport, date) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchGames = async () => {
      try {
        setLoading(true);
        const response = await api.get('/games', {
          params: { sport, date },
        });
        setGames(response.data);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchGames();
  }, [sport, date]);
  
  return { games, loading, error };
}
```

**Fetch Odds** (`src/hooks/useOdds.js`):
```javascript
import { useState, useEffect } from 'react';
import api from '../utils/api';

export function useOdds(gameId) {
  const [odds, setOdds] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!gameId) return;
    
    const fetchOdds = async () => {
      try {
        const response = await api.get(`/odds/${gameId}`);
        setOdds(response.data);
      } catch (err) {
        console.error('Failed to fetch odds:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchOdds();
    
    // Poll every 30 seconds for live odds
    const interval = setInterval(fetchOdds, 30000);
    return () => clearInterval(interval);
  }, [gameId]);
  
  return { odds, loading };
}
```

---

## Styling

### Tailwind CSS Configuration

**tailwind.config.js**:
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
```

### Global Styles

**src/index.css**:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-gray-50 text-gray-900 font-sans;
  }
}

@layer components {
  .btn-primary {
    @apply px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 
           transition-colors duration-200;
  }
  
  .card {
    @apply bg-white rounded-lg shadow-md p-4;
  }
}
```

---

## Development

### Local Setup

```bash
# Navigate to frontend directory
cd dashboard/frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Server runs on http://localhost:5173
```

### Development Server Features

- ⚡ **Hot Module Replacement (HMR)**: Instant updates without full reload
- 🔍 **Source maps**: Easy debugging in browser DevTools
- 📦 **Fast refresh**: Preserves component state during edits

### Environment Variables

**Create `.env` file**:
```bash
VITE_API_URL=http://localhost:3001/api
VITE_ENABLE_ANALYTICS=false
```

**Access in code**:
```javascript
const apiUrl = import.meta.env.VITE_API_URL;
```

---

## Building & Deployment

### Production Build

```bash
# Build optimized bundle
npm run build

# Output in dist/ directory
# Preview build locally
npm run preview
```

### Build Output

```
dist/
├── index.html
├── assets/
│   ├── index-a1b2c3d4.js      # Main bundle (minified)
│   ├── index-e5f6g7h8.css     # Styles (minified)
│   └── logo-i9j0k1l2.svg      # Static assets
└── vite.svg
```

### Docker Build

**Dockerfile** (multi-stage build):
```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Nginx Configuration

**nginx.conf**:
```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;
    
    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # API proxy
    location /api {
        proxy_pass http://backend:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
}
```

---

## Testing

### Vitest Configuration

**vite.config.js**:
```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.js',
  },
});
```

### Example Tests

```javascript
// tests/components/GameCard.test.jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GameCard } from '../../src/components/GameCard';

describe('GameCard', () => {
  const mockGame = {
    id: '1',
    homeTeam: 'Lakers',
    awayTeam: 'Celtics',
    homeOdds: -150,
    awayOdds: 130,
    commenceTime: '2026-01-15T19:30:00Z',
  };
  
  it('renders team names', () => {
    render(<GameCard game={mockGame} />);
    expect(screen.getByText('Lakers')).toBeInTheDocument();
    expect(screen.getByText('Celtics')).toBeInTheDocument();
  });
  
  it('displays odds correctly', () => {
    render(<GameCard game={mockGame} />);
    expect(screen.getByText('-150')).toBeInTheDocument();
    expect(screen.getByText('+130')).toBeInTheDocument();
  });
});
```

### Run Tests

```bash
# Run all tests
npm run test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

---

## Next Steps

- [Backend API Guide](Backend-Guide)
- [Database Schema](Database-Guide)
- [MCP Server Guide](MCP-Server-Guide)
