-- AlterTable
ALTER TABLE "bet_legs" ADD COLUMN     "sgp_group_id" VARCHAR(50);

-- CreateTable
CREATE TABLE "futures" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "external_id" VARCHAR(100) NOT NULL,
    "sport_id" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "season" VARCHAR(20),
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "settlement_date" TIMESTAMPTZ(6),
    "winner" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "futures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "future_outcomes" (
    "id" SERIAL NOT NULL,
    "future_id" UUID NOT NULL,
    "outcome" VARCHAR(200) NOT NULL,
    "description" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "future_outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "current_future_odds" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "future_id" UUID NOT NULL,
    "bookmaker" VARCHAR(50) NOT NULL,
    "outcome" VARCHAR(200) NOT NULL,
    "price" INTEGER NOT NULL,
    "last_updated" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "current_future_odds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "future_odds_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "future_id" UUID NOT NULL,
    "bookmaker" VARCHAR(50) NOT NULL,
    "outcome" VARCHAR(200) NOT NULL,
    "price" INTEGER NOT NULL,
    "captured_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "future_odds_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bet_leg_futures" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bet_id" UUID NOT NULL,
    "future_id" UUID NOT NULL,
    "outcome" VARCHAR(200) NOT NULL,
    "odds" INTEGER NOT NULL,
    "user_adjusted_odds" INTEGER,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bet_leg_futures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "futures_external_id_key" ON "futures"("external_id");

-- CreateIndex
CREATE INDEX "futures_sport_id_idx" ON "futures"("sport_id");

-- CreateIndex
CREATE INDEX "futures_status_idx" ON "futures"("status");

-- CreateIndex
CREATE UNIQUE INDEX "future_outcomes_future_id_outcome_key" ON "future_outcomes"("future_id", "outcome");

-- CreateIndex
CREATE INDEX "current_future_odds_future_id_idx" ON "current_future_odds"("future_id");

-- CreateIndex
CREATE UNIQUE INDEX "current_future_odds_future_id_bookmaker_outcome_key" ON "current_future_odds"("future_id", "bookmaker", "outcome");

-- CreateIndex
CREATE INDEX "bet_leg_futures_future_id_idx" ON "bet_leg_futures"("future_id");

-- AddForeignKey
ALTER TABLE "futures" ADD CONSTRAINT "futures_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "future_outcomes" ADD CONSTRAINT "future_outcomes_future_id_fkey" FOREIGN KEY ("future_id") REFERENCES "futures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "current_future_odds" ADD CONSTRAINT "current_future_odds_future_id_fkey" FOREIGN KEY ("future_id") REFERENCES "futures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "future_odds_snapshots" ADD CONSTRAINT "future_odds_snapshots_future_id_fkey" FOREIGN KEY ("future_id") REFERENCES "futures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bet_leg_futures" ADD CONSTRAINT "bet_leg_futures_bet_id_fkey" FOREIGN KEY ("bet_id") REFERENCES "bets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bet_leg_futures" ADD CONSTRAINT "bet_leg_futures_future_id_fkey" FOREIGN KEY ("future_id") REFERENCES "futures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
