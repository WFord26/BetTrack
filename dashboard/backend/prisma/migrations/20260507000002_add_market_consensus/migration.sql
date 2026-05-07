-- CreateTable
CREATE TABLE "market_consensus" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_id" UUID NOT NULL,
    "market_type" VARCHAR(20) NOT NULL,
    "calculated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consensus_line" DECIMAL(8,2) NOT NULL,
    "standard_deviation" DECIMAL(8,2) NOT NULL,
    "outlier_bookmakers" JSONB NOT NULL,
    "bookmaker_count" INTEGER NOT NULL,
    "disagreement_score" INTEGER NOT NULL,
    "best_value" JSONB NOT NULL,

    CONSTRAINT "market_consensus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "market_consensus_game_id_idx" ON "market_consensus"("game_id");

-- CreateIndex
CREATE INDEX "market_consensus_disagreement_score_idx" ON "market_consensus"("disagreement_score");

-- CreateIndex
CREATE INDEX "market_consensus_calculated_at_idx" ON "market_consensus"("calculated_at");

-- AddForeignKey
ALTER TABLE "market_consensus" ADD CONSTRAINT "market_consensus_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
