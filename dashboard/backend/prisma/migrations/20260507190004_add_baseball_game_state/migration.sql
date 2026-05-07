-- AlterTable
ALTER TABLE "games" ADD COLUMN     "balls" INTEGER,
ADD COLUMN     "inning_half" VARCHAR(10),
ADD COLUMN     "outs" INTEGER,
ADD COLUMN     "strikes" INTEGER;
