-- CreateTable
CREATE TABLE "admin_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "risk_high_threshold" DOUBLE PRECISION NOT NULL DEFAULT 1000,
    "risk_moderate_threshold" DOUBLE PRECISION NOT NULL DEFAULT 500,
    "win_rate_low" DOUBLE PRECISION NOT NULL DEFAULT 45,
    "win_rate_high" DOUBLE PRECISION NOT NULL DEFAULT 55,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_settings_pkey" PRIMARY KEY ("id")
);
