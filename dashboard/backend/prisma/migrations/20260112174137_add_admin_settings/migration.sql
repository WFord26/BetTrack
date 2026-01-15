-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_admin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "site_config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "site_name" VARCHAR(100) NOT NULL DEFAULT 'Sports Betting',
    "logo_url" VARCHAR(500),
    "domain_url" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_config_pkey" PRIMARY KEY ("id")
);
