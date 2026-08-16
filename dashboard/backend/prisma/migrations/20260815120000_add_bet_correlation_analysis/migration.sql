-- CreateTable
CREATE TABLE "bet_leg_correlations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bet_leg1_id" UUID NOT NULL,
    "bet_leg2_id" UUID NOT NULL,
    "correlation_type" VARCHAR(30) NOT NULL,
    "correlation_score" DECIMAL(5,4) NOT NULL,
    "confidence" DECIMAL(5,4) NOT NULL,
    "reasoning" TEXT,
    "common_factors" JSONB,
    "historical_samples" INTEGER,
    "p_value" DECIMAL(6,5),

    CONSTRAINT "bet_leg_correlations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parlay_analyses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" UUID NOT NULL,
    "bet_leg_ids" UUID[],
    "bet_id" UUID,
    "nominal_odds" INTEGER NOT NULL,
    "true_odds" INTEGER NOT NULL,
    "odds_discrepancy" DECIMAL(5,2) NOT NULL,
    "risk_level" VARCHAR(20) NOT NULL,
    "correlation_flags" JSONB NOT NULL,
    "recommendation" VARCHAR(30) NOT NULL,
    "reasoning" TEXT NOT NULL,
    "suggested_fix" TEXT,
    "placed" BOOLEAN NOT NULL DEFAULT false,
    "actual_result" VARCHAR(20),

    CONSTRAINT "parlay_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bet_leg_correlations_bet_leg1_id_bet_leg2_id_key" ON "bet_leg_correlations"("bet_leg1_id", "bet_leg2_id");
CREATE INDEX "bet_leg_correlations_correlation_type_idx" ON "bet_leg_correlations"("correlation_type");
CREATE INDEX "bet_leg_correlations_correlation_score_idx" ON "bet_leg_correlations"("correlation_score");

CREATE INDEX "parlay_analyses_user_id_idx" ON "parlay_analyses"("user_id");
CREATE INDEX "parlay_analyses_created_at_idx" ON "parlay_analyses"("created_at");
CREATE INDEX "parlay_analyses_risk_level_idx" ON "parlay_analyses"("risk_level");

-- AddForeignKey
ALTER TABLE "bet_leg_correlations" ADD CONSTRAINT "bet_leg_correlations_bet_leg1_id_fkey" FOREIGN KEY ("bet_leg1_id") REFERENCES "bet_legs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bet_leg_correlations" ADD CONSTRAINT "bet_leg_correlations_bet_leg2_id_fkey" FOREIGN KEY ("bet_leg2_id") REFERENCES "bet_legs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "parlay_analyses" ADD CONSTRAINT "parlay_analyses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "parlay_analyses" ADD CONSTRAINT "parlay_analyses_bet_id_fkey" FOREIGN KEY ("bet_id") REFERENCES "bets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
