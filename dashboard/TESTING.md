# Testing & Validation Setup

## Overview

This project includes comprehensive testing infrastructure for both frontend and backend components, integrated with GitHub Actions for CI/CD.

## Test Stack

### Backend Testing
- **Framework**: Jest with ts-jest
- **Test Runner**: Jest
- **Database**: PostgreSQL (test instance)
- **Mocking**: jest-mock-extended, @jest/globals
- **API Testing**: supertest
- **Coverage**: Built-in Jest coverage

### Frontend Testing
- **Framework**: Vitest
- **Testing Library**: React Testing Library
- **Environment**: jsdom
- **Coverage**: @vitest/coverage-v8
- **UI Testing**: @vitest/ui

## Running Tests Locally

### Backend Tests

```bash
cd dashboard/backend

# Install dependencies (first time only)
npm install

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests in CI mode (no watch, coverage, max workers)
npm run test:ci

# Run linter
npm run lint
npm run lint:fix
```

### Frontend Tests

```bash
cd dashboard/frontend

# Install dependencies (first time only)
npm install

# Run all tests
npm test

# Run tests in watch mode (interactive)
npm run test:watch

# Run tests with UI viewer
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Run tests in CI mode
npm run test:ci

# Run linter
npm run lint
npm run lint:fix

# Type checking
npx tsc --noEmit
```

## Test File Organization

### Backend (`dashboard/backend/`)
```
tests/
├── setup.ts              # Jest configuration and global mocks
├── bet.service.test.ts   # Existing bet service integration tests
└── odds-calculator.test.ts  # Existing odds calculator tests
```

### Frontend (`dashboard/frontend/src/`)
```
test/
├── setup.ts              # Vitest configuration and global mocks
└── test-utils.tsx        # Redux store wrapper, mock data, helpers

components/
└── bets/
    ├── BetSlip.tsx
    └── BetSlip.test.tsx  # Example component test

store/
├── betSlipSlice.ts
└── betSlipSlice.test.ts  # Example Redux slice test

utils/
├── format.ts
└── format.test.ts        # Example utility function test
```

## Writing Tests

### Backend Test Example (Jest)

```typescript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { prisma } from '../src/config/database';
import { betService } from '../src/services/bet.service';

describe('Bet Service', () => {
  beforeEach(async () => {
    // Setup test data
  });

  afterEach(async () => {
    // Cleanup
    await prisma.bet.deleteMany({});
  });

  it('creates a bet', async () => {
    const bet = await betService.createBet({
      name: 'Test Bet',
      betType: 'single',
      stake: 100,
      legs: [/* ... */]
    });

    expect(bet.name).toBe('Test Bet');
    expect(bet.stake.toNumber()).toBe(100);
  });
});
```

### Frontend Component Test Example (Vitest)

```typescript
import { describe, it, expect } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { BetSlip } from '@/components/bets/BetSlip';

describe('BetSlip', () => {
  it('renders empty state', () => {
    renderWithProviders(<BetSlip />);
    expect(screen.getByText(/no selections/i)).toBeInTheDocument();
  });

  it('handles user interaction', async () => {
    renderWithProviders(<BetSlip />);
    const button = screen.getByRole('button', { name: /place bet/i });
    fireEvent.click(button);
    // Assert behavior
  });
});
```

### Redux Slice Test Example

```typescript
import { describe, it, expect } from 'vitest';
import betSlipReducer, { addLeg, clearBetSlip } from '@/store/betSlipSlice';

describe('BetSlip Slice', () => {
  it('adds a leg', () => {
    const initialState = { legs: [], betType: 'single', stake: 0 };
    const leg = { gameId: '1', selectionType: 'moneyline', /* ... */ };
    
    const newState = betSlipReducer(initialState, addLeg(leg));
    
    expect(newState.legs).toHaveLength(1);
  });
});
```

## Test Utilities

### Frontend Test Helpers

- **`renderWithProviders()`**: Renders components with Redux store and Router
- **`createMockStore()`**: Creates a mock Redux store for testing
- **`mockGame`**: Sample game data
- **`mockOddsSnapshot`**: Sample odds data
- **`mockBet`**: Sample bet data
- **`waitForAsync()`**: Helper for async state updates

### Backend Test Setup

- **Prisma Mocking**: Automatically mocked in `tests/setup.ts`
- **Environment Variables**: Configured for test environment
- **Database Cleanup**: Use `afterEach()` hooks for cleanup

## Coverage Reports

### Viewing Coverage

After running tests with coverage:

```bash
# Backend
cd dashboard/backend
npm run test:coverage
open coverage/index.html  # Or start coverage/index.html

# Frontend
cd dashboard/frontend
npm run test:coverage
open coverage/index.html
```

### Coverage Thresholds

Both frontend and backend enforce **60% coverage** minimum for:
- Lines
- Functions
- Branches
- Statements

## CI/CD Integration

### GitHub Actions Workflows

#### 1. Test & Validate (`.github/workflows/test.yml`)

Runs on:
- Pull requests to `main`, `beta`, `develop`
- Pushes to `main`, `beta`

Jobs:
- **backend-tests**: Jest tests with PostgreSQL service
- **frontend-tests**: Vitest tests with type checking
- **mcp-validation**: Python linting and syntax checks
- **build-validation**: Ensures all components build successfully

#### 2. Release Build (`.github/workflows/release.yml`)

Enhanced with testing:
- Runs all tests before building
- Blocks release if tests fail
- Includes linting and validation
- Deploys only if all checks pass

### Test Workflow Features

- ✅ Parallel test execution (backend, frontend, MCP)
- ✅ PostgreSQL test database
- ✅ Code coverage reporting with Codecov
- ✅ PR comments with test results
- ✅ Linting enforcement
- ✅ Type checking (TypeScript)
- ✅ Build artifact verification

## Pre-Commit Testing

**IMPORTANT**: Always run tests before committing code:

```bash
# Quick validation
cd dashboard/backend && npm test
cd dashboard/frontend && npm test

# Full validation (recommended before PR)
cd dashboard/backend
npm run lint && npm run test:coverage

cd dashboard/frontend
npm run lint && npx tsc --noEmit && npm run test:coverage

# Build validation (before release)
cd dashboard/backend && npm run build
cd dashboard/frontend && npm run build
```

## Debugging Tests

### Backend (Jest)

```bash
# Run specific test file
npm test bet.service.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="creates a bet"

# Debug with Node inspector
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Frontend (Vitest)

```bash
# Run specific test file
npm test -- BetSlip.test.tsx

# Run tests matching pattern
npm test -- --grep "renders empty state"

# Use UI mode for debugging
npm run test:ui
```

## Best Practices

### General
- ✅ Write tests alongside feature code
- ✅ Aim for meaningful coverage (not just high %)
- ✅ Test user behavior, not implementation details
- ✅ Use descriptive test names
- ✅ Keep tests isolated and independent

### Backend
- ✅ Clean up database after each test
- ✅ Mock external API calls
- ✅ Test error cases and edge cases
- ✅ Use transactions when possible

### Frontend
- ✅ Use `renderWithProviders()` for Redux components
- ✅ Test user interactions (clicks, inputs)
- ✅ Verify rendered output
- ✅ Mock API calls with MSW or similar
- ✅ Test accessibility where applicable

## Troubleshooting

### Common Issues

**Backend: Database connection errors**
```bash
# Ensure PostgreSQL is running
# Update DATABASE_URL in .env or use test database
export DATABASE_URL=postgresql://test:test@localhost:5432/test_db
```

**Frontend: Module resolution errors**
```bash
# Check tsconfig.json paths
# Verify vite.config.ts alias configuration
```

**Coverage not generating**
```bash
# Backend: Check jest.config.js collectCoverageFrom
# Frontend: Check vite.config.ts coverage settings
```

### Getting Help

- Check test output for specific error messages
- Review test setup files (`setup.ts`)
- Verify dependencies are installed (`npm ci`)
- Check GitHub Actions logs for CI failures

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Vitest Documentation](https://vitest.dev/guide/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Redux](https://redux.js.org/usage/writing-tests)

## Future Enhancements

- [ ] E2E testing with Playwright or Cypress
- [ ] Visual regression testing
- [ ] Performance testing
- [ ] Integration with SonarQube
- [ ] Automated test report generation
