-- AlterTable
ALTER TABLE "games" ADD COLUMN     "api_sports_game_id" VARCHAR(50),
ADD COLUMN     "api_sports_league_id" INTEGER,
ADD COLUMN     "season" VARCHAR(20),
ADD COLUMN     "season_type" VARCHAR(20);

-- AlterTable
ALTER TABLE "players" ADD COLUMN     "api_sports_player_id" INTEGER;

-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "api_sports_team_id" INTEGER;

-- CreateIndex
CREATE INDEX "games_api_sports_game_id_idx" ON "games"("api_sports_game_id");

-- CreateIndex
CREATE INDEX "games_season_idx" ON "games"("season");

-- CreateIndex
CREATE INDEX "players_api_sports_player_id_idx" ON "players"("api_sports_player_id");

-- CreateIndex
CREATE INDEX "teams_api_sports_team_id_idx" ON "teams"("api_sports_team_id");
