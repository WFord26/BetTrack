import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

function buildDatabaseUrl(rawEnv: NodeJS.ProcessEnv): string | undefined {
  const explicitDatabaseUrl = rawEnv.DATABASE_URL;

  if (explicitDatabaseUrl && !explicitDatabaseUrl.includes('${')) {
    return explicitDatabaseUrl;
  }

  const databaseType = rawEnv.DATABASE_TYPE || 'postgresql';
  const databaseHost = rawEnv.DATABASE_HOST;
  const databasePort = rawEnv.DATABASE_PORT || '5432';
  const databaseName = rawEnv.DATABASE_NAME;
  const databaseUser = rawEnv.DATABASE_USER || rawEnv.DB_USER;
  const databasePassword = rawEnv.DATABASE_PASSWORD || rawEnv.DB_PASSWORD;

  if (!databaseHost || !databaseName || !databaseUser || !databasePassword) {
    return undefined;
  }

  const encodedUser = encodeURIComponent(databaseUser);
  const encodedPassword = encodeURIComponent(databasePassword);

  return `${databaseType}://${encodedUser}:${encodedPassword}@${databaseHost}:${databasePort}/${databaseName}`;
}

const normalizedEnv = {
  ...process.env,
  DATABASE_URL: buildDatabaseUrl(process.env),
};

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001'),
  DATABASE_URL: z.string(),
  ODDS_API_KEY: z.string(),
  JWT_SECRET: z.string().optional(),
  SESSION_SECRET: z.string().optional(),
  ODDS_SYNC_INTERVAL: z.string().default('10'),
  OUTCOME_CHECK_INTERVAL: z.string().default('5'),
  LOG_LEVEL: z.string().default('info'),
  CORS_ORIGIN: z.string().optional(),
  
  // API-Sports configuration
  API_SPORTS_KEY: z.string().optional(),
  API_SPORTS_TIER: z.enum(['free', 'pro', 'ultra', 'mega']).default('pro'),
  STATS_POLL_INTERVAL_MS: z.string().default('15000'),
  ENABLE_WEBSOCKETS: z.string().default('false'),
  REDIS_URL: z.string().optional(),
  
  // Auth configuration
  AUTH_MODE: z.enum(['none', 'oauth2']).default('none'),
  BASE_URL: z.string().default('http://localhost:3001'),
  
  // Microsoft/Azure AD OAuth2
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_TENANT_ID: z.string().optional(),
  
  // Google OAuth2
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional()
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validates and sanitizes environment configuration
 * In production, ensures critical secrets are set
 * In development, allows defaults with warnings
 */
function validateAndSanitizeConfig(rawConfig: z.infer<typeof envSchema>): EnvConfig {
  const nodeEnv = rawConfig.NODE_ENV;
  
  // Validate secrets based on environment
  if (nodeEnv === 'production') {
    if (!rawConfig.JWT_SECRET) {
      console.error('❌ CRITICAL: JWT_SECRET is required in production');
      console.error('   Set JWT_SECRET environment variable to a strong random string (32+ characters)');
      process.exit(1);
    }
    if (!rawConfig.SESSION_SECRET) {
      console.error('❌ CRITICAL: SESSION_SECRET is required in production');
      console.error('   Set SESSION_SECRET environment variable to a strong random string (32+ characters)');
      process.exit(1);
    }
  } else if (nodeEnv === 'development') {
    // In development, use secure defaults with warnings
    if (!rawConfig.JWT_SECRET) {
      console.warn('⚠️  JWT_SECRET not set, using development default (NOT PRODUCTION SAFE)');
      rawConfig.JWT_SECRET = 'dev-secret-' + Math.random().toString(36).slice(2, 18);
    }
    if (!rawConfig.SESSION_SECRET) {
      console.warn('⚠️  SESSION_SECRET not set, using development default (NOT PRODUCTION SAFE)');
      rawConfig.SESSION_SECRET = 'dev-session-' + Math.random().toString(36).slice(2, 18);
    }
  }
  
  return rawConfig as EnvConfig;
}

let config: EnvConfig;

try {
  const parsedEnv = envSchema.parse(normalizedEnv);
  config = validateAndSanitizeConfig(parsedEnv);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Invalid environment variables:');
    error.errors.forEach(err => {
      console.error(`  ${err.path.join('.')}: ${err.message}`);
    });
    process.exit(1);
  }
  throw error;
}

export const env = config;
