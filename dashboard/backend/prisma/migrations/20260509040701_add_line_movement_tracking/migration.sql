-- AlterTable
ALTER TABLE "odds_snapshots" ADD COLUMN     "movement_size" DECIMAL(5,2),
ADD COLUMN     "movement_type" VARCHAR(20),
ADD COLUMN     "volume_indicator" INTEGER;

-- CreateTable
CREATE TABLE "line_movements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_id" UUID NOT NULL,
    "market_type" VARCHAR(20) NOT NULL,
    "detected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "movement_type" VARCHAR(20) NOT NULL,
    "lines_before" JSONB NOT NULL,
    "lines_after" JSONB NOT NULL,
    "bookmaker_count" INTEGER NOT NULL,
    "average_movement" DECIMAL(5,2) NOT NULL,
    "time_to_move" INTEGER NOT NULL,
    "max_movement" DECIMAL(5,2),
    "suspected_cause" VARCHAR(100),

    CONSTRAINT "line_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "line_movements_game_id_idx" ON "line_movements"("game_id");

-- CreateIndex
CREATE INDEX "line_movements_movement_type_idx" ON "line_movements"("movement_type");

-- CreateIndex
CREATE INDEX "line_movements_detected_at_idx" ON "line_movements"("detected_at");

-- CreateIndex
CREATE INDEX "odds_snapshots_movement_type_idx" ON "odds_snapshots"("movement_type");

-- AddForeignKey
ALTER TABLE "line_movements" ADD CONSTRAINT "line_movements_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
