-- CreateTable
CREATE TABLE "bookmaker_analytics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bookmaker" VARCHAR(50) NOT NULL,
    "average_clv_offered" DECIMAL(5,2) NOT NULL,
    "best_odds_frequency" DECIMAL(5,2) NOT NULL,
    "margin_vs_consensus" DECIMAL(5,2) NOT NULL,
    "outlier_frequency" DECIMAL(5,2) NOT NULL,
    "first_mover_frequency" DECIMAL(5,2) NOT NULL,
    "line_movement_lag" INTEGER NOT NULL,
    "sharp_book_rating" INTEGER NOT NULL,
    "market_efficiency" DECIMAL(5,2) NOT NULL,
    "sports_covered" TEXT[],
    "markets_covered" TEXT[],
    "uptime_percentage" DECIMAL(5,2) NOT NULL,
    "odds_update_frequency" INTEGER NOT NULL,
    "average_odds_age" INTEGER NOT NULL,
    "limit_profile" VARCHAR(20) NOT NULL,
    "estimated_max_bet" DECIMAL(10,2),
    "account_limit_reports" INTEGER NOT NULL,
    "total_games_offered" INTEGER NOT NULL,
    "total_markets_offered" INTEGER NOT NULL,
    "average_margin" DECIMAL(5,2) NOT NULL,
    "user_rating" DECIMAL(3,2),
    "user_review_count" INTEGER NOT NULL DEFAULT 0,
    "recommendation_score" INTEGER NOT NULL,
    "calculated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookmaker_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookmaker_movement_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_id" UUID NOT NULL,
    "market_type" VARCHAR(20) NOT NULL,
    "detected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "first_mover" VARCHAR(50) NOT NULL,
    "first_move_time" TIMESTAMPTZ(6) NOT NULL,
    "followers" JSONB NOT NULL,
    "movement_size" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "bookmaker_movement_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bookmaker_analytics_bookmaker_key" ON "bookmaker_analytics"("bookmaker");

-- CreateIndex
CREATE INDEX "bookmaker_analytics_best_odds_frequency_idx" ON "bookmaker_analytics"("best_odds_frequency");

-- CreateIndex
CREATE INDEX "bookmaker_analytics_sharp_book_rating_idx" ON "bookmaker_analytics"("sharp_book_rating");

-- CreateIndex
CREATE INDEX "bookmaker_movement_events_first_mover_idx" ON "bookmaker_movement_events"("first_mover");

-- CreateIndex
CREATE INDEX "bookmaker_movement_events_detected_at_idx" ON "bookmaker_movement_events"("detected_at");

-- AddForeignKey
ALTER TABLE "bookmaker_movement_events" ADD CONSTRAINT "bookmaker_movement_events_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
