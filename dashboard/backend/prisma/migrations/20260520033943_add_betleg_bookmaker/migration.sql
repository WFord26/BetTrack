-- AlterTable
ALTER TABLE "bet_legs" ADD COLUMN     "bookmaker" VARCHAR(50);

-- CreateIndex
CREATE INDEX "bet_legs_bookmaker_idx" ON "bet_legs"("bookmaker");
