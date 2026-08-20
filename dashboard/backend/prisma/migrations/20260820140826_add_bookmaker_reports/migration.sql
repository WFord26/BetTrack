-- CreateEnum
CREATE TYPE "bookmaker_report_type" AS ENUM ('OUTAGE', 'LIMIT_REDUCTION');

-- CreateTable
CREATE TABLE "bookmaker_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "bookmaker" VARCHAR(50) NOT NULL,
    "report_type" "bookmaker_report_type" NOT NULL,
    "note" VARCHAR(280),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookmaker_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bookmaker_reports_bookmaker_created_at_idx" ON "bookmaker_reports"("bookmaker", "created_at");

-- CreateIndex
CREATE INDEX "bookmaker_reports_user_id_bookmaker_created_at_idx" ON "bookmaker_reports"("user_id", "bookmaker", "created_at");

-- AddForeignKey
ALTER TABLE "bookmaker_reports" ADD CONSTRAINT "bookmaker_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
