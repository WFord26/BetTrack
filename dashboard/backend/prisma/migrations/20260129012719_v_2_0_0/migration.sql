-- CreateTable
CREATE TABLE "players" (
    "id" SERIAL NOT NULL,
    "external_id" VARCHAR(50),
    "team_id" INTEGER,
    "first_name" VARCHAR(50) NOT NULL,
    "last_name" VARCHAR(50) NOT NULL,
    "position" VARCHAR(20),
    "number" INTEGER,
    "photo_url" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_stats" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "team_id" INTEGER NOT NULL,
    "sport_key" VARCHAR(50) NOT NULL,
    "season" INTEGER NOT NULL,
    "season_type" VARCHAR(20) NOT NULL DEFAULT 'regular',
    "offense" JSONB NOT NULL DEFAULT '{}',
    "defense" JSONB NOT NULL DEFAULT '{}',
    "standings" JSONB NOT NULL DEFAULT '{}',
    "games_played" INTEGER NOT NULL DEFAULT 0,
    "last_updated" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_stats" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_id" UUID NOT NULL,
    "team_id" INTEGER NOT NULL,
    "is_home" BOOLEAN NOT NULL,
    "quarter_scores" JSONB,
    "stats" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_game_stats" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_id" UUID NOT NULL,
    "player_id" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,
    "stats" JSONB NOT NULL DEFAULT '{}',
    "started" BOOLEAN NOT NULL DEFAULT false,
    "minutes_played" VARCHAR(10),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_game_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "players_team_id_idx" ON "players"("team_id");

-- CreateIndex
CREATE INDEX "players_external_id_idx" ON "players"("external_id");

-- CreateIndex
CREATE INDEX "team_stats_sport_key_season_idx" ON "team_stats"("sport_key", "season");

-- CreateIndex
CREATE UNIQUE INDEX "team_stats_team_id_season_season_type_key" ON "team_stats"("team_id", "season", "season_type");

-- CreateIndex
CREATE INDEX "game_stats_game_id_idx" ON "game_stats"("game_id");

-- CreateIndex
CREATE UNIQUE INDEX "game_stats_game_id_team_id_key" ON "game_stats"("game_id", "team_id");

-- CreateIndex
CREATE INDEX "player_game_stats_game_id_idx" ON "player_game_stats"("game_id");

-- CreateIndex
CREATE INDEX "player_game_stats_player_id_idx" ON "player_game_stats"("player_id");

-- CreateIndex
CREATE UNIQUE INDEX "player_game_stats_game_id_player_id_key" ON "player_game_stats"("game_id", "player_id");

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_stats" ADD CONSTRAINT "team_stats_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_stats" ADD CONSTRAINT "game_stats_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_stats" ADD CONSTRAINT "game_stats_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_game_stats" ADD CONSTRAINT "player_game_stats_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_game_stats" ADD CONSTRAINT "player_game_stats_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_game_stats" ADD CONSTRAINT "player_game_stats_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
