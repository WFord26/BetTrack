-- CreateTable
CREATE TABLE "arbitrage_opportunities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_id" UUID NOT NULL,
    "detected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "arb_type" VARCHAR(20) NOT NULL,
    "market_type" VARCHAR(20) NOT NULL,
    "profit_percentage" DECIMAL(5,2) NOT NULL,
    "stake" DECIMAL(10,2) NOT NULL,
    "expected_profit" DECIMAL(10,2) NOT NULL,
    "legs" JSONB NOT NULL,
    "middle_probability" DECIMAL(5,4),
    "middle_gap_low" DECIMAL(6,2),
    "middle_gap_high" DECIMAL(6,2),
    "risk_level" VARCHAR(20) NOT NULL,
    "risk_factors" TEXT[],
    "limit_risk" BOOLEAN NOT NULL,
    "odds_drift" DECIMAL(5,2),
    "odds_snapshot_age" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "taken_at" TIMESTAMPTZ(6),
    "user_id" UUID,
    "actual_profit" DECIMAL(10,2),

    CONSTRAINT "arbitrage_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "arbitrage_opportunities_game_id_idx" ON "arbitrage_opportunities"("game_id");
CREATE INDEX "arbitrage_opportunities_status_idx" ON "arbitrage_opportunities"("status");
CREATE INDEX "arbitrage_opportunities_profit_percentage_idx" ON "arbitrage_opportunities"("profit_percentage");
CREATE INDEX "arbitrage_opportunities_detected_at_idx" ON "arbitrage_opportunities"("detected_at");
CREATE INDEX "arbitrage_opportunities_expires_at_idx" ON "arbitrage_opportunities"("expires_at");
CREATE INDEX "arbitrage_opportunities_user_id_idx" ON "arbitrage_opportunities"("user_id");

-- AddForeignKey
ALTER TABLE "arbitrage_opportunities" ADD CONSTRAINT "arbitrage_opportunities_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "arbitrage_opportunities" ADD CONSTRAINT "arbitrage_opportunities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
