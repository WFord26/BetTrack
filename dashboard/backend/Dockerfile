# Multi-stage production build for Sports Dashboard Backend
# Optimized for size and security
# Supports .env files and Docker secrets for configuration
# Build context: dashboard/ (workspace root)

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ openssl

# Copy workspace package files
COPY package*.json ./

# Copy backend package files
COPY backend/package*.json ./backend/

# Install dependencies from workspace root
RUN npm ci

# Copy prisma schema
COPY backend/prisma ./backend/prisma

# Generate Prisma Client
RUN cd backend && npx prisma generate

# Copy TypeScript source
COPY backend/tsconfig*.json ./backend/
COPY backend/src ./backend/src

# Build TypeScript to JavaScript
RUN cd backend && npm run build

# Prune dev dependencies (run from workspace root)
RUN npm prune --production

# Stage 2: Production runtime
FROM node:20-alpine

WORKDIR /app

# Install only runtime dependencies
RUN apk add --no-cache openssl dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built application from builder
COPY --from=builder --chown=nodejs:nodejs /app/backend/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/backend/prisma ./prisma
COPY --from=builder --chown=nodejs:nodejs /app/backend/package*.json ./

# Copy startup script for Docker secrets support
COPY --chown=nodejs:nodejs <<'EOF' /app/docker-entrypoint.sh
#!/bin/sh
set -e

# Load secrets from Docker secrets (if mounted at /run/secrets/)
if [ -d "/run/secrets" ]; then
  for secret_file in /run/secrets/*; do
    if [ -f "$secret_file" ]; then
      secret_name=$(basename "$secret_file")
      secret_value=$(cat "$secret_file")
      
      # Convert secret filename to uppercase env var
      env_name=$(echo "$secret_name" | tr '[:lower:]' '[:upper:]')
      export "$env_name=$secret_value"
      
      echo "Loaded secret: $env_name"
    fi
  done
fi

# Load .env file if present (Docker secrets take precedence)
if [ -f "/app/.env" ]; then
  echo "Loading environment from .env file"
  export $(grep -v '^#' /app/.env | xargs)
fi

# Run Prisma migrations if AUTO_MIGRATE is set
if [ "$AUTO_MIGRATE" = "true" ]; then
  echo "Running database migrations..."
  npx prisma migrate deploy
fi

# Execute the main command
exec "$@"
EOF

RUN chmod +x /app/docker-entrypoint.sh

# Generate Prisma Client in production (prisma schema is in ./prisma)
RUN cd /app && npx prisma generate --schema=./prisma/schema.prisma

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Environment variables (can be overridden)
ENV NODE_ENV=production \
    PORT=3001 \
    LOG_LEVEL=info

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--", "/app/docker-entrypoint.sh"]

# Start production server
CMD ["node", "dist/server.js"]
