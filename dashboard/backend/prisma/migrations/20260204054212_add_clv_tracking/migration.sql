-- AlterTable
ALTER TABLE "bet_legs" ADD COLUMN     "closing_odds" INTEGER,
ADD COLUMN     "clv" DECIMAL(5,2),
ADD COLUMN     "clv_category" VARCHAR(20);

-- CreateTable
CREATE TABLE "user_clv_stats" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "sport_key" VARCHAR(50) NOT NULL,
    "bet_type" VARCHAR(20) NOT NULL,
    "period" VARCHAR(20) NOT NULL,
    "total_bets" INTEGER NOT NULL,
    "average_clv" DECIMAL(5,2) NOT NULL,
    "positive_clv_count" INTEGER NOT NULL,
    "negative_clv_count" INTEGER NOT NULL,
    "clv_win_rate" DECIMAL(5,2) NOT NULL,
    "expected_roi" DECIMAL(5,2) NOT NULL,
    "actual_roi" DECIMAL(5,2) NOT NULL,
    "calculated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_clv_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_clv_stats_user_id_idx" ON "user_clv_stats"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_clv_stats_user_id_sport_key_bet_type_period_key" ON "user_clv_stats"("user_id", "sport_key", "bet_type", "period");

-- AddForeignKey
ALTER TABLE "user_clv_stats" ADD CONSTRAINT "user_clv_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
