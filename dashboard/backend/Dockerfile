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

strip_wrapping_quotes() {
  value="$1"

  case "$value" in
    \"*\")
      value=${value#\"}
      value=${value%\"}
      ;;
    \'*\')
      value=${value#\'}
      value=${value%\'}
      ;;
  esac

  printf '%s' "$value"
}

load_env_file() {
  env_file_path="$1"

  if [ ! -f "$env_file_path" ]; then
    return
  fi

  echo "Loading environment from $env_file_path"

  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      ''|\#*)
        continue
        ;;
    esac

    key=${line%%=*}
    value=${line#*=}

    if [ -z "$key" ] || [ "$key" = "$line" ]; then
      continue
    fi

    current_value=$(printenv "$key" 2>/dev/null || true)

    if [ -n "$current_value" ]; then
      continue
    fi

    value=$(strip_wrapping_quotes "$value")
    export "$key=$value"
  done < "$env_file_path"
}

load_docker_secrets() {
  if [ ! -d "/run/secrets" ]; then
    return
  fi

  for secret_file in /run/secrets/*; do
    if [ -f "$secret_file" ]; then
      secret_name=$(basename "$secret_file")
      secret_value=$(cat "$secret_file")
      env_name=$(echo "$secret_name" | tr '[:lower:]' '[:upper:]')

      export "$env_name=$secret_value"
      echo "Loaded secret: $env_name"
    fi
  done
}

build_database_url() {
  if [ -n "$DATABASE_URL" ] && ! printf '%s' "$DATABASE_URL" | grep -q '\${'; then
    return
  fi

  db_scheme="${DATABASE_TYPE:-postgresql}"
  db_host="${DATABASE_HOST:-}"
  db_port="${DATABASE_PORT:-5432}"
  db_name="${DATABASE_NAME:-}"
  db_user="${DATABASE_USER:-${DB_USER:-}}"
  db_password="${DATABASE_PASSWORD:-${DB_PASSWORD:-}}"

  if [ -z "$db_host" ] || [ -z "$db_name" ] || [ -z "$db_user" ] || [ -z "$db_password" ]; then
    return
  fi

  encoded_db_user=$(node -e "process.stdout.write(encodeURIComponent(process.argv[1]))" "$db_user")
  encoded_db_password=$(node -e "process.stdout.write(encodeURIComponent(process.argv[1]))" "$db_password")

  export DATABASE_URL="${db_scheme}://${encoded_db_user}:${encoded_db_password}@${db_host}:${db_port}/${db_name}"
  echo "Constructed DATABASE_URL from component environment variables"
}

load_env_file "/app/.env"
load_docker_secrets
build_database_url

# Run Prisma migrations if AUTO_MIGRATE is set
if [ "$AUTO_MIGRATE" = "true" ]; then
  echo "Running database migrations..."
  npx prisma migrate deploy
fi

# Execute the main command
exec "$@"
EOF

RUN chmod +x /app/docker-entrypoint.sh

# Prisma Client already generated in builder stage and copied with node_modules
# No need to regenerate here

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
