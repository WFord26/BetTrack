# Frontend README

React + TypeScript + Vite + Tailwind CSS frontend for the Sports Betting Dashboard.

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
