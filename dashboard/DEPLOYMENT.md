# Deployment Checklist

## Pre-Deployment Verification

### Database
- [ ] Migrations tested in staging environment
- [ ] Database backup created
- [ ] Connection pooling configured
- [ ] Indexes optimized
- [ ] Sensitive data encrypted

### Backend
- [ ] All environment variables documented
- [ ] API keys secured (not in code)
- [ ] Rate limiting configured
- [ ] CORS settings correct for production domain
- [ ] Error logging enabled (Winston)
- [ ] Health check endpoint working
- [ ] Scheduled jobs configured correctly
- [ ] Build completes without errors: `npm run build`
- [ ] Tests passing: `npm test`

### Frontend
- [ ] API base URL configured for production
- [ ] Build optimized: `npm run build`
- [ ] Bundle size acceptable (<1MB initial)
- [ ] Error boundaries in place
- [ ] Loading states for all async operations
- [ ] Toast notifications working
- [ ] Responsive design tested on mobile
- [ ] Browser compatibility verified (Chrome, Firefox, Safari, Edge)

### APIs
- [ ] The Odds API key valid and rate limits understood
- [ ] ESPN API endpoints accessible
- [ ] Fallback handling for API failures
- [ ] Response caching implemented where appropriate
- [ ] Request timeouts configured

### Security
- [ ] JWT secrets generated (32+ character random strings)
- [ ] API tokens use secure hashing (SHA-256)
- [ ] HTTPS enforced in production
- [ ] Helmet middleware configured
- [ ] SQL injection protection (Prisma parameterized queries)
- [ ] XSS protection enabled
- [ ] CSRF tokens for state-changing operations
- [ ] Input validation on all endpoints (Zod)

### Performance
- [ ] Database queries optimized (use EXPLAIN)
- [ ] Prisma connection pooling configured
- [ ] Frontend code splitting implemented
- [ ] Images optimized and lazy loaded
- [ ] API response times <500ms for most endpoints
- [ ] Frontend initial load <3 seconds

## Deployment Steps

### 1. Database Setup

```bash
# Production database
createdb sports_betting_prod

# Update DATABASE_URL in .env

# Run migrations
cd backend
npm run prisma:migrate

# Initialize sports data
npm run init:sports

# Verify migrations
npm run prisma:studio
```

### 2. Backend Deployment

**Environment Variables** (.env.production):
```env
DATABASE_URL="postgresql://user:password@prod-host:5432/sports_betting_prod"
ODDS_API_KEY="production-key"
ODDS_API_BASE_URL="https://api.the-odds-api.com/v4"
ESPN_API_BASE_URL="https://site.api.espn.com/apis/site/v2"
ODDS_SYNC_CRON="*/10 * * * *"
BET_SETTLEMENT_CRON="*/5 * * * *"
PORT=3001
NODE_ENV=production
JWT_SECRET="<64-char-random-string>"
```

**Build and Start**:
```bash
cd backend

# Install production dependencies only
npm ci --production

# Build TypeScript
npm run build

# Start with PM2 (recommended)
pm2 start dist/server.js --name sports-betting-backend

# Or use npm
npm start
```

**PM2 Configuration** (ecosystem.config.js):
```javascript
module.exports = {
  apps: [{
    name: 'sports-betting-backend',
    script: './dist/server.js',
    instances: 2,
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production'
    }
  }]
};
```

### 3. Frontend Deployment

**Environment Variables** (.env.production):
```env
VITE_API_BASE_URL=https://api.yourdomain.com/api
```

**Build**:
```bash
cd frontend
npm run build
# Output in: dist/
```

**Deploy to Static Host**:
- **Vercel**: `vercel --prod`
- **Netlify**: `netlify deploy --prod`
- **Nginx**: Copy `dist/` to `/var/www/html`
- **S3 + CloudFront**: Upload `dist/` to S3 bucket

**Nginx Configuration** (nginx.conf):
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        root /var/www/html;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4. SSL Certificate

```bash
# Using Let's Encrypt with Certbot
sudo certbot --nginx -d yourdomain.com
```

### 5. Monitoring Setup

**Backend Health Check**:
```bash
curl https://api.yourdomain.com/health
```

**Expected Response**:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-08T12:00:00.000Z",
  "database": "connected"
}
```

**PM2 Monitoring**:
```bash
pm2 monit
pm2 logs sports-betting-backend
```

**Set up Uptime Monitor**:
- UptimeRobot: https://uptimerobot.com
- Pingdom: https://www.pingdom.com
- Monitor: `/health` endpoint every 5 minutes

## Post-Deployment

### Verification

- [ ] Health check endpoint responds: `curl https://api.yourdomain.com/health`
- [ ] Frontend loads without errors
- [ ] Can create test bet
- [ ] Odds sync job runs: Check logs
- [ ] Bet settlement job runs: Check logs
- [ ] Database connections stable
- [ ] No console errors in browser
- [ ] API endpoints respond within 500ms
- [ ] SSL certificate valid
- [ ] HTTPS redirect working

### Initial Data

```bash
# Trigger initial odds sync
curl -X POST http://localhost:3001/api/admin/sync-odds

# Or via script
cd backend
npm run sync:odds
```

### Create Admin API Token

```bash
cd backend
npm run create:token "Production MCP"
# Save token securely
```

### Monitoring

- [ ] Set up error alerting (email/Slack)
- [ ] Monitor API rate limits (The Odds API)
- [ ] Track database size growth
- [ ] Monitor server CPU/memory usage
- [ ] Set up log aggregation (Papertrail, Loggly)

## Rollback Plan

### Database Rollback
```bash
# Revert last migration
npm run prisma:migrate:resolve -- --rolled-back

# Restore from backup
pg_restore -d sports_betting_prod backup.sql
```

### Application Rollback
```bash
# PM2
pm2 stop sports-betting-backend
git checkout <previous-commit>
npm run build
pm2 restart sports-betting-backend

# Verify
curl https://api.yourdomain.com/health
```

## Maintenance

### Database Backups
```bash
# Daily backup cron (add to crontab)
0 2 * * * pg_dump sports_betting_prod > /backups/db-$(date +\%Y\%m\%d).sql

# Automated backup with retention
0 2 * * * pg_dump sports_betting_prod | gzip > /backups/db-$(date +\%Y\%m\%d).sql.gz && find /backups -name "db-*.sql.gz" -mtime +30 -delete
```

### Log Rotation
```bash
# PM2 log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### Updates
```bash
# Pull latest code
git pull origin main

# Backend
cd backend
npm ci
npm run build
pm2 restart sports-betting-backend

# Frontend
cd frontend
npm ci
npm run build
# Deploy dist/ to static host

# Database migrations
cd backend
npm run prisma:migrate
```

## Scaling Considerations

### When to Scale

- API response times >1 second consistently
- Database CPU >70% sustained
- Server memory >80%
- The Odds API rate limits hit frequently
- >1000 concurrent users

### Horizontal Scaling

**Backend**:
- Add more server instances behind load balancer
- Use PM2 cluster mode: `instances: 'max'`
- Configure session affinity if needed

**Database**:
- Enable read replicas for queries
- Use connection pooling (Prisma already configured)
- Consider PostgreSQL partitioning for large tables

**Frontend**:
- Use CDN for static assets
- Enable Cloudflare caching
- Implement service worker for offline support

## Common Issues

### Odds Not Syncing
- Check The Odds API key validity
- Verify rate limits not exceeded
- Check cron job logs: `pm2 logs`
- Manual trigger: `npm run sync:odds`

### Bets Not Settling
- Check ESPN API accessibility
- Verify cron job running
- Check for games with missing scores
- Manual trigger: `npm run resolve:outcomes`

### Database Connection Errors
- Check connection pool limits
- Verify DATABASE_URL
- Check PostgreSQL max_connections
- Monitor active connections: `SELECT count(*) FROM pg_stat_activity;`

### High API Response Times
- Check database query performance
- Enable query logging: Prisma query logs
- Add missing indexes
- Implement Redis caching

## Support Contacts

- The Odds API: https://the-odds-api.com/support
- Prisma: https://www.prisma.io/support
- PostgreSQL: https://www.postgresql.org/support/

## Emergency Procedures

### Complete System Failure
1. Switch to maintenance page
2. Check error logs: `pm2 logs --err`
3. Verify database connectivity
4. Restart services: `pm2 restart all`
5. If database corrupted, restore from backup
6. Notify users of downtime

### Data Breach
1. Immediately rotate all API keys and JWT secrets
2. Force logout all users (invalidate tokens)
3. Audit database access logs
4. Notify affected users
5. Review security measures
6. Update authentication systems

### API Key Compromised
1. Rotate API key immediately
2. Update environment variables
3. Restart backend: `pm2 restart sports-betting-backend`
4. Monitor for unusual activity
5. Review recent API usage logs
