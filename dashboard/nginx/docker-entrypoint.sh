#!/bin/sh
# Nginx startup script with environment variable substitution
# Replaces variables in the template with actual values

set -e

# Check if DOMAIN is set
if [ -z "$DOMAIN" ]; then
    echo "ERROR: DOMAIN environment variable not set"
    echo "Please set DOMAIN in docker-compose.yml or .env file"
    exit 1
fi

# Set SSL certificate paths with defaults
SSL_CERT="${SSL_CERT:-/etc/letsencrypt/live/${DOMAIN}/fullchain.pem}"
SSL_KEY="${SSL_KEY:-/etc/letsencrypt/live/${DOMAIN}/privkey.pem}"

echo "Configuring nginx for domain: $DOMAIN"
echo "SSL Certificate: $SSL_CERT"
echo "SSL Key: $SSL_KEY"

# Export variables for envsubst
export DOMAIN
export SSL_CERT
export SSL_KEY

# Substitute environment variables in template
envsubst '${DOMAIN} ${SSL_CERT} ${SSL_KEY}' < /etc/nginx/conf.d/nginx.conf.template > /etc/nginx/conf.d/default.conf

echo "Nginx configuration generated successfully"
echo "Main site: https://$DOMAIN"
echo "API endpoint: https://api.$DOMAIN"

# Test nginx configuration
nginx -t

# Start nginx in foreground
exec nginx -g 'daemon off;'
