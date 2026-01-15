/*
  Warnings:

  - You are about to drop the `api_tokens` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "bets" ADD COLUMN     "user_id" UUID;

-- AlterTable
ALTER TABLE "games" ADD COLUMN     "clock" VARCHAR(20),
ADD COLUMN     "period" VARCHAR(20),
ADD COLUMN     "venue" VARCHAR(200),
ADD COLUMN     "weather" VARCHAR(100);

-- DropTable
DROP TABLE "api_tokens";

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255),
    "avatar_url" VARCHAR(500),
    "provider" VARCHAR(50) NOT NULL,
    "provider_id" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "name" VARCHAR(100) NOT NULL,
    "key_hash" VARCHAR(255) NOT NULL,
    "key_prefix" VARCHAR(20) NOT NULL,
    "permissions" JSONB NOT NULL DEFAULT '{"read": true, "write": true, "bets": true, "stats": true}',
    "last_used_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_key_usage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "api_key_id" UUID NOT NULL,
    "endpoint" VARCHAR(200) NOT NULL,
    "method" VARCHAR(10) NOT NULL,
    "ip_address" VARCHAR(50),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_key_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_provider_provider_id_key" ON "users"("provider", "provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "api_keys_user_id_idx" ON "api_keys"("user_id");

-- CreateIndex
CREATE INDEX "api_keys_revoked_idx" ON "api_keys"("revoked");

-- CreateIndex
CREATE INDEX "api_key_usage_api_key_id_idx" ON "api_key_usage"("api_key_id");

-- CreateIndex
CREATE INDEX "api_key_usage_created_at_idx" ON "api_key_usage"("created_at");

-- CreateIndex
CREATE INDEX "bets_user_id_idx" ON "bets"("user_id");

-- AddForeignKey
ALTER TABLE "bets" ADD CONSTRAINT "bets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_key_usage" ADD CONSTRAINT "api_key_usage_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
