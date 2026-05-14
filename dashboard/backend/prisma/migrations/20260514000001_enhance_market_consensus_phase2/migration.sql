-- AlterTable
ALTER TABLE "market_consensus"
  ADD COLUMN "consensus_price" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "median_line" DECIMAL(8,2) NOT NULL DEFAULT 0,
  ADD COLUMN "mean_line" DECIMAL(8,2) NOT NULL DEFAULT 0,
  ADD COLUMN "mode_line" DECIMAL(8,2),
  ADD COLUMN "range" DECIMAL(8,2) NOT NULL DEFAULT 0,
  ADD COLUMN "interquartile_range" DECIMAL(8,2) NOT NULL DEFAULT 0,
  ADD COLUMN "best_value_side" VARCHAR(20) NOT NULL DEFAULT 'home',
  ADD COLUMN "best_value_bookmaker" VARCHAR(50) NOT NULL DEFAULT '',
  ADD COLUMN "best_value_line" DECIMAL(8,2) NOT NULL DEFAULT 0,
  ADD COLUMN "sharp_book_weight" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- Backfill new columns from existing values where possible
UPDATE "market_consensus"
SET
  "consensus_price" = CASE
    WHEN "market_type" = 'h2h' THEN ROUND("consensus_line")::INTEGER
    ELSE -110
  END,
  "median_line" = "consensus_line",
  "mean_line" = "consensus_line",
  "range" = 0,
  "interquartile_range" = 0,
  "best_value_side" = COALESCE("best_value"->>'side', 'home'),
  "best_value_bookmaker" = COALESCE("best_value"->>'bookmaker', ''),
  "best_value_line" = COALESCE(NULLIF("best_value"->>'line', '')::DECIMAL, "consensus_line"),
  "sharp_book_weight" = 0;

-- CreateIndex
CREATE INDEX "market_consensus_market_type_idx" ON "market_consensus"("market_type");
