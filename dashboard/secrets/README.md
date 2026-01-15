# Docker Secrets Setup Guide

This directory contains secrets for production Docker deployments.

## Setup

1. Create this directory structure:
   ```
   secrets/
   ├── db_user.txt
   ├── db_password.txt
   ├── odds_api_key.txt
   └── session_secret.txt
   ```

2. Add your secrets (one value per file, no newlines):
   ```bash
   echo -n "sports_user" > secrets/db_user.txt
   echo -n "your_secure_password_here" > secrets/db_password.txt
   echo -n "your_odds_api_key_here" > secrets/odds_api_key.txt
   echo -n "$(openssl rand -hex 32)" > secrets/session_secret.txt
   ```

3. Secure the secrets directory:
   ```bash
   chmod 600 secrets/*.txt
   ```

4. Start the stack:
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

## Security Notes

- **Never commit secrets to git** - This directory is in .gitignore
- **Use external secret stores in production** (AWS Secrets Manager, Azure Key Vault, HashiCorp Vault)
- **Rotate secrets regularly**
- **Use least-privilege database users**

## Using External Secret Stores

### AWS Secrets Manager
Use the AWS Secrets Manager Docker plugin or fetch secrets at runtime.

### Azure Key Vault
Use managed identities with Azure Container Instances or AKS.

### Kubernetes Secrets
Convert to Kubernetes manifests and use native secrets:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: sports-dashboard-secrets
type: Opaque
stringData:
  db_password: your_password
  odds_api_key: your_api_key
```

## Alternative: Environment Variables

For development or CI/CD, you can also use environment variables:
```bash
export DB_USER="sports_user"
export DB_PASSWORD="secure_password"
export ODDS_API_KEY="your_api_key"
export SESSION_SECRET="$(openssl rand -hex 32)"

docker-compose up
```

The backend Docker image will automatically load both secrets and environment variables.
