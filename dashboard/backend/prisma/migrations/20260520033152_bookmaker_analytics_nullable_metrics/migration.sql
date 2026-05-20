-- AlterTable
ALTER TABLE "admin_settings" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "bookmaker_analytics" ALTER COLUMN "average_clv_offered" DROP NOT NULL,
ALTER COLUMN "uptime_percentage" DROP NOT NULL,
ALTER COLUMN "recommendation_score" DROP NOT NULL;

-- AlterTable
ALTER TABLE "market_consensus" ALTER COLUMN "consensus_price" DROP DEFAULT,
ALTER COLUMN "median_line" DROP DEFAULT,
ALTER COLUMN "mean_line" DROP DEFAULT,
ALTER COLUMN "range" DROP DEFAULT,
ALTER COLUMN "interquartile_range" DROP DEFAULT,
ALTER COLUMN "best_value_side" DROP DEFAULT,
ALTER COLUMN "best_value_bookmaker" DROP DEFAULT,
ALTER COLUMN "best_value_line" DROP DEFAULT,
ALTER COLUMN "sharp_book_weight" DROP DEFAULT;
