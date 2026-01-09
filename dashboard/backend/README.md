# Backend README

Node.js + Express + TypeScript + Prisma backend for the Sports Betting Dashboard.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your database URL and API keys
```

3. Set up database:
```bash
npm run prisma:migrate
npm run prisma:generate
```

## Development

```bash
# Start development server with hot reload
npm run dev
```

Server runs on http://localhost:3001

## Database

```bash
# Generate Prisma client
npm run prisma:generate

# Create new migration
npm run prisma:migrate

# Open Prisma Studio
npm run prisma:studio

# Deploy migrations (production)
npm run prisma:deploy
```

## Project Structure

```
src/
├── config/         # Configuration (env, database, logger)
├── controllers/    # Request handlers
├── services/       # Business logic
├── routes/         # API routes
├── middleware/     # Express middleware
├── utils/          # Utility functions
├── jobs/           # Scheduled tasks
└── types/          # TypeScript types
```

## Building

```bash
npm run build
npm start
```
