import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001'),
  DATABASE_URL: z.string(),
  ODDS_API_KEY: z.string(),
  JWT_SECRET: z.string().default('change-me-in-production'),
  SESSION_SECRET: z.string().default('change-me-in-production-session'),
  ODDS_SYNC_INTERVAL: z.string().default('10'),
  OUTCOME_CHECK_INTERVAL: z.string().default('5'),
  LOG_LEVEL: z.string().default('info'),
  
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

let config: EnvConfig;

try {
  config = envSchema.parse(process.env);
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
