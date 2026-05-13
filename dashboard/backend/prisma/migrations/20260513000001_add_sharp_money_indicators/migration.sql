-- CreateTable
CREATE TABLE "sharp_money_indicators" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_id" UUID NOT NULL,
    "market_type" VARCHAR(20) NOT NULL,
    "calculated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "line_movement" VARCHAR(20) NOT NULL,
    "sharp_side" VARCHAR(20) NOT NULL,
    "public_side" VARCHAR(20) NOT NULL,
    "sharp_confidence" INTEGER NOT NULL,
    "contraindicators" TEXT[],
    "public_betting_pct" DECIMAL(5,2),
    "public_money_pct" DECIMAL(5,2),

    CONSTRAINT "sharp_money_indicators_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sharp_money_indicators_game_id_idx" ON "sharp_money_indicators"("game_id");

-- CreateIndex
CREATE INDEX "sharp_money_indicators_sharp_side_idx" ON "sharp_money_indicators"("sharp_side");

-- CreateIndex
CREATE INDEX "sharp_money_indicators_calculated_at_idx" ON "sharp_money_indicators"("calculated_at");

-- AddForeignKey
ALTER TABLE "sharp_money_indicators" ADD CONSTRAINT "sharp_money_indicators_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
