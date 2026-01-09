# Sports Betting Dashboard - Authentication Setup Guide

## Overview

The Sports Betting Dashboard supports two authentication modes:

1. **Standalone Mode (`AUTH_MODE=none`)** - No authentication, single user
2. **Multi-User Mode (`AUTH_MODE=oauth2`)** - OAuth2 authentication with Microsoft Azure AD or Google

## Standalone Mode (No Authentication)

**Use Case**: Personal use, local deployment, Docker container

**Setup**:
```bash
# In backend/.env
AUTH_MODE=none
```

That's it! No additional configuration needed.

## Multi-User Mode (OAuth2)

**Use Case**: Hosting on cloud, multiple users, real money tracking

### Option 1: Microsoft Azure AD (Entra ID)

#### Step 1: Register Application in Azure Portal

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to: **Azure Active Directory** → **App registrations** → **New registration**
3. Fill in:
   - **Name**: Sports Betting Dashboard
   - **Supported account types**: Choose based on your needs:
     - **Single tenant**: Only your organization
     - **Multitenant**: Any Azure AD organization
     - **Personal Microsoft accounts**: Anyone with Microsoft account
   - **Redirect URI**: 
     - Platform: **Web**
     - URL: `http://localhost:3001/api/auth/microsoft/callback` (for local)
     - URL: `https://yourdomain.com/api/auth/microsoft/callback` (for production)

4. Click **Register**

#### Step 2: Get Client ID and Secret

1. After registration, you'll see the **Application (client) ID** - copy this
2. Copy the **Directory (tenant) ID** 
3. Go to **Certificates & secrets** → **New client secret**
4. Add description, set expiration, click **Add**
5. **Copy the secret value immediately** (it won't be shown again)

#### Step 3: Configure API Permissions

1. Go to **API permissions** → **Add a permission**
2. Select **Microsoft Graph** → **Delegated permissions**
3. Add these permissions:
   - `User.Read`
   - `email`
   - `openid`
   - `profile`
4. Click **Grant admin consent** (if required by your org)

#### Step 4: Update Environment Variables

```bash
# In backend/.env
AUTH_MODE=oauth2
BASE_URL=http://localhost:3001  # Change for production
SESSION_SECRET=generate-a-long-random-string-here

MICROSOFT_CLIENT_ID=your-application-client-id
MICROSOFT_CLIENT_SECRET=your-client-secret-value
MICROSOFT_TENANT_ID=your-tenant-id  # Or 'common' for multi-tenant
```

### Option 2: Google OAuth2

#### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing one
3. Go to **APIs & Services** → **OAuth consent screen**
4. Configure consent screen:
   - **User Type**: External (for personal) or Internal (for workspace)
   - **App name**: Sports Betting Dashboard
   - **User support email**: Your email
   - **Scopes**: Add `email`, `profile`, `openid`
   - **Test users**: Add your email addresses (for testing)

#### Step 2: Create OAuth2 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: Sports Betting Dashboard
5. **Authorized redirect URIs**:
   - Add: `http://localhost:3001/api/auth/google/callback` (local)
   - Add: `https://yourdomain.com/api/auth/google/callback` (production)
6. Click **Create**
7. Copy **Client ID** and **Client secret**

#### Step 3: Update Environment Variables

```bash
# In backend/.env
AUTH_MODE=oauth2
BASE_URL=http://localhost:3001  # Change for production
SESSION_SECRET=generate-a-long-random-string-here

GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### Supporting Both Providers

You can enable both Microsoft and Google simultaneously:

```bash
AUTH_MODE=oauth2
BASE_URL=http://localhost:3001

# Enable both
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
MICROSOFT_TENANT_ID=common

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

Users will see both login options and can choose their preferred provider.

## Database Migration

After configuring auth mode, run the database migration:

```bash
cd backend
npx prisma migrate dev --name add_user_authentication
npx prisma generate
```

## Testing Authentication

### Test Standalone Mode
```bash
AUTH_MODE=none
npm run dev
# Access http://localhost:3001 - no login required
```

### Test OAuth2 Mode
```bash
AUTH_MODE=oauth2
# Set your OAuth credentials
npm run dev
# Access http://localhost:3001 - redirects to login
# Click "Login with Microsoft" or "Login with Google"
```

## Security Best Practices

1. **SESSION_SECRET**: Generate a strong random string (32+ characters)
   ```bash
   # Linux/Mac
   openssl rand -hex 32
   
   # Windows PowerShell
   [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
   ```

2. **HTTPS in Production**: Always use HTTPS for OAuth callbacks
   - Update `BASE_URL` to use `https://`
   - Update redirect URIs in Azure/Google console to use `https://`

3. **Environment Variables**: Never commit `.env` to git
   - Use secrets management in production (Azure Key Vault, AWS Secrets Manager)
   - Rotate client secrets periodically (every 90 days)

4. **Tenant ID for Azure**:
   - Use specific tenant ID for single-tenant apps (more secure)
   - Use `common` for multi-tenant (allows any Microsoft account)

## Troubleshooting

### "Redirect URI mismatch" error
- Ensure `BASE_URL` matches the redirect URI in Azure/Google console
- Check for trailing slashes (must match exactly)

### "User not found" or "No email" error
- Verify API permissions are granted in Azure/Google
- Check that email scope is requested

### Session not persisting
- Ensure `SESSION_SECRET` is set and consistent
- Check that Redis or session store is configured if using in production

### Multiple users with same email
- The system prevents creating accounts with duplicate emails across providers
- Users must use the same provider they registered with initially

## Production Deployment

For production deployment, additionally configure:

1. **Session Store**: Use Redis instead of in-memory sessions
   ```typescript
   // In server.ts
   import RedisStore from "connect-redis";
   import { createClient } from "redis";
   
   const redisClient = createClient({ url: process.env.REDIS_URL });
   redisClient.connect();
   
   app.use(session({
     store: new RedisStore({ client: redisClient }),
     // ... other options
   }));
   ```

2. **HTTPS Only**: Force HTTPS in production
   ```typescript
   app.use(session({
     cookie: {
       secure: process.env.NODE_ENV === 'production', // HTTPS only
       httpOnly: true,
       sameSite: 'lax'
     }
   }));
   ```

3. **Environment Variables**: Use cloud secrets management
   - Azure Key Vault
   - AWS Secrets Manager
   - Google Secret Manager

## Switching Between Modes

You can switch between standalone and OAuth2 modes at any time:

1. **To enable auth**: Set `AUTH_MODE=oauth2`, configure OAuth, restart server
2. **To disable auth**: Set `AUTH_MODE=none`, restart server

**Note**: Existing bets will remain accessible. In standalone mode, all bets are visible. In OAuth2 mode, each user sees only their own bets.

## Support

For issues or questions:
- Check backend logs: `docker-compose logs backend`
- Verify `.env` configuration
- Test OAuth providers separately using their test tools
