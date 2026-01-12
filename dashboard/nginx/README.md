# Nginx Configuration for BetTrack Dashboard

This directory contains nginx reverse proxy configuration for production deployments.

## Quick Setup

1. **Set your domain:**
   ```bash
   cd dashboard
   cp .env.prod.example .env
   # Edit .env and set DOMAIN=yourdomain.com
   ```

2. **The `DOMAIN` variable configures everything:**
   - Main site: `https://${DOMAIN}`
   - API endpoint: `https://api.${DOMAIN}`
   - SSL certificates: `/etc/letsencrypt/live/${DOMAIN}/` (default)
   - CORS headers: `https://${DOMAIN}`

3. **Optional: Custom SSL certificates:**
   ```env
   # In .env file
   SSL_CERT=/path/to/your/cert.crt
   SSL_KEY=/path/to/your/key.key
   ```

   If not specified, defaults to Let's Encrypt paths based on `DOMAIN`.

## Architecture

**Production Setup (with Nginx):**
```
Internet
   ↓
Nginx (HTTPS Load Balancer)
   ├── ${DOMAIN} → Frontend (port 80)
   └── api.${DOMAIN} → Backend API (port 3001)
```

**Local Development (without Nginx):**
```
Frontend (localhost:5173) → Backend API (localhost:3001)
MCP Server → Backend API (localhost:3001)
```

## Domain Setup

Set the `DOMAIN` environment variable in `.env` file:

```env
DOMAIN=yourdomain.com
```

This automatically configures:
- **Main Site**: `https://yourdomain.com` - Serves React frontend
- **API Subdomain**: `https://api.yourdomain.com` - Backend REST API
- **SSL Certificates**: Defaults to `/etc/letsencrypt/live/yourdomain.com/`
- **CORS**: Allows requests from `https://yourdomain.com`

**Optional SSL variables:**
```env
SSL_CERT=/custom/path/to/cert.crt
SSL_KEY=/custom/path/to/key.key
```

If not specified, uses Let's Encrypt paths: `/etc/letsencrypt/live/${DOMAIN}/fullchain.pem`

## How It Works

The nginx configuration uses a **template file** (`nginx.conf.template`) with variable placeholders. At container startup:

1. Docker entrypoint script reads environment variables:
   - `DOMAIN` (required)
   - `SSL_CERT` (optional, defaults to Let's Encrypt path)
   - `SSL_KEY` (optional, defaults to Let's Encrypt path)
2. `envsubst` replaces all variable occurrences in template
3. Generates final nginx configuration
4. Validates config with `nginx -t`
5. Starts nginx

**Files:**
- `nginx.conf.template` - Template with `${DOMAIN}`, `${SSL_CERT}`, `${SSL_KEY}` variables
- `docker-entrypoint.sh` - Startup script that does substitution
- `docker-compose.prod.yml` - Passes variables from `.env` to container

## SSL Certificate Setup

### Initial Certificate Generation

1. **Start nginx with HTTP only (for ACME challenge):**
   ```bash
   # Temporarily comment out SSL server blocks in nginx.conf
   docker-compose -f docker-compose.prod.yml up -d nginx
   ```

2. **Generate certificates using certbot:**
   ```bash
   # Replace yourdomain.com with your actual domain
   DOMAIN=yourdomain.com
   
   docker run -it --rm \
     -v "/etc/letsencrypt:/etc/letsencrypt" \
     -v "/var/lib/letsencrypt:/var/lib/letsencrypt" \
     -v "/var/www/certbot:/var/www/certbot" \
     certbot/certbot certonly \
     --webroot \
     --webroot-path=/var/www/certbot \
     --email your-email@example.com \
     --agree-tos \
     --no-eff-email \
     -d $DOMAIN \
     -d api.$DOMAIN
   ```

3. **Uncomment SSL server blocks and restart:**
   ```bash
   docker-compose -f docker-compose.prod.yml restart nginx
   ```

### Certificate Renewal

Certificates auto-renew via cron job in nginx container:
```bash
# Runs daily at 2am
0 2 * * * certbot renew --webroot --webroot-path=/var/www/certbot && nginx -s reload
```

## Environment Variables

The `DOMAIN` variable is automatically used throughout the stack:

**Nginx** (set in dashboard/.env):
```env
DOMAIN=yourdomain.com
```

**Frontend** (auto-configured via docker-compose):
```env
VITE_API_URL=https://api.${DOMAIN}
```

**MCP Server** (set in your MCP environment):
```env
DASHBOARD_API_URL=https://api.${DOMAIN}
DASHBOARD_API_KEY=your_api_key_here
```

## DNS Configuration

Set up DNS A/AAAA records for both domains:

```bash
# Replace with your server IP
DOMAIN=yourdomain.com
SERVER_IP=your.server.ip.address

# DNS records needed:
${DOMAIN}       A     ${SERVER_IP}
api.${DOMAIN}   A     ${SERVER_IP}
```

## Deployment

1. **Configure environment:**
   ```bash
   cd dashboard
   cp .env.prod.example .env
   nano .env  # Set DOMAIN=yourdomain.com
   ```

2. **Configure DNS** (allow 24-48h for propagation)

3. **Generate SSL certificates** (see SSL section above)

4. **Deploy with docker-compose:**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

5. **Verify deployment:**
   ```bash
   # Check nginx generated config
   docker-compose -f docker-compose.prod.yml logs nginx | head -20
   
   # Should see:
   # "Configuring nginx for domain: yourdomain.com"
   # "SSL Certificate: /etc/letsencrypt/live/yourdomain.com/fullchain.pem"
   # "SSL Key: /etc/letsencrypt/live/yourdomain.com/privkey.pem"
   # "Main site: https://yourdomain.com"
   # "API endpoint: https://api.yourdomain.com"
   ```

## Using Custom SSL Certificates

If you have your own SSL certificates (not Let's Encrypt):

1. **Mount certificate directory in docker-compose.prod.yml:**
   ```yaml
   nginx:
     volumes:
       - /path/to/your/certs:/etc/ssl/custom:ro
   ```

2. **Set paths in .env:**
   ```env
   DOMAIN=yourdomain.com
   SSL_CERT=/etc/ssl/custom/yourdomain.crt
   SSL_KEY=/etc/ssl/custom/yourdomain.key
   ```

3. **Deploy:**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d --force-recreate nginx
   ```

This works with:
- Commercial SSL certificates (DigiCert, Sectigo, etc.)
- Self-signed certificates (for testing)
- Wildcard certificates
- Any PEM-format certificate

## Features

### Security
- **HTTPS Only** - All HTTP traffic redirects to HTTPS
- **HSTS** - HTTP Strict Transport Security headers
- **Modern SSL/TLS** - TLS 1.2 and 1.3 only
- **Security Headers** - X-Frame-Options, X-Content-Type-Options, etc.
- **CORS** - Configured for cross-origin requests from frontend

### Performance
- **Gzip Compression** - Reduces bandwidth for text-based assets
- **HTTP/2** - Modern protocol for faster page loads
- **Static Asset Caching** - 1 year cache for immutable assets
- **Connection Keepalive** - Reduces connection overhead

### Reliability
- **Health Checks** - Monitors backend/frontend availability
- **Timeouts** - Prevents hung connections
- **Load Balancing** - Ready for multiple backend instances

## Testing

After deployment, test with your actual domain:

```bash
# Set your domain
DOMAIN=yourdomain.com

# Test HTTPS redirect
curl -I http://$DOMAIN

# Test frontend
curl -I https://$DOMAIN

# Test API health
curl -I https://api.$DOMAIN/health

# Test API with authentication
curl -H "Authorization: Bearer YOUR_TOKEN" https://api.$DOMAIN/api/games
```

## Troubleshooting

### Check nginx logs
```bash
docker-compose -f docker-compose.prod.yml logs nginx
```

### Test nginx configuration
```bash
docker-compose -f docker-compose.prod.yml exec nginx nginx -t
```

### Reload nginx without downtime
```bash
docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

### Certificate issues
```bash
# Set your domain
DOMAIN=yourdomain.com

# Check certificate expiration
docker-compose -f docker-compose.prod.yml exec nginx \
  openssl x509 -in /etc/letsencrypt/live/$DOMAIN/fullchain.pem -noout -dates

# Manual renewal
docker run -it --rm \
  -v "/etc/letsencrypt:/etc/letsencrypt" \
  -v "/var/lib/letsencrypt:/var/lib/letsencrypt" \
  -v "/var/www/certbot:/var/www/certbot" \
  certbot/certbot renew
```

### Configuration not updating

If you change `DOMAIN` in `.env`, you need to recreate the container:

```bash
docker-compose -f docker-compose.prod.yml up -d --force-recreate nginx
```

## Local Development

For local development, nginx is **not needed**. Use the standard docker-compose.yml:

```bash
# Local development (no nginx)
cd dashboard
docker-compose up -d

# Frontend: http://localhost:5173
# Backend API: http://localhost:3001
```

The React dev server proxies API requests to the backend automatically via Vite configuration.
