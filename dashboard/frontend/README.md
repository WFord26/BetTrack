# Frontend README

React + TypeScript + Vite + Tailwind CSS frontend for the Sports Betting Dashboard.

## Features

- **Modern React** - React 18 with functional components and hooks
- **TypeScript** - Full type safety with strict mode
- **Redux Toolkit** - State management for bet slip and preferences
- **Tailwind CSS** - Utility-first styling with dark mode support
- **React Router** - Client-side routing with protected routes
- **Vite** - Lightning-fast dev server and build tool
- **Odds Boost UI** - Interactive slider for parlay boosts (0-100%)
- **React Portals** - Modal rendering for proper z-index layering

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env if needed (defaults to http://localhost:3001/api)
```

## Development

```bash
# Start development server
npm run dev
```

Application runs on http://localhost:5173

## Project Structure

```
src/
├── components/     # React components
│   ├── common/    # Reusable UI components
│   ├── odds/      # Odds display components
│   ├── bets/      # Bet management components
│   └── stats/     # Statistics components
├── pages/         # Page components (routes)
├── hooks/         # Custom React hooks
├── store/         # Redux store and slices
├── services/      # API client
├── types/         # TypeScript types
└── App.tsx        # Root component
```

## Building

```bash
npm run build
npm run preview
```

Build output goes to `dist/`
