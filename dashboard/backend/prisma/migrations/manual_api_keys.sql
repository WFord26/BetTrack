-- Manual migration script for API Keys feature
-- Run this if you can't run Prisma migrate but have database access

-- Create api_keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  key_hash VARCHAR(255) UNIQUE NOT NULL,
  key_prefix VARCHAR(20) NOT NULL,
  permissions JSONB DEFAULT '{"read": true, "write": true, "bets": true, "stats": true}'::jsonb,
  last_used_at TIMESTAMPTZ(6),
  expires_at TIMESTAMPTZ(6),
  revoked BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ(6) DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ(6) DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS api_keys_revoked_idx ON api_keys(revoked);

-- Create api_key_usage table
CREATE TABLE IF NOT EXISTS api_key_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint VARCHAR(200) NOT NULL,
  method VARCHAR(10) NOT NULL,
  ip_address VARCHAR(50),
  user_agent VARCHAR(500),
  created_at TIMESTAMPTZ(6) DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS api_key_usage_api_key_id_idx ON api_key_usage(api_key_id);
CREATE INDEX IF NOT EXISTS api_key_usage_created_at_idx ON api_key_usage(created_at);

-- Display success message
SELECT 'API Keys tables created successfully!' AS message;
