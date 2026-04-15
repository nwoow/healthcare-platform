-- AlterTable: add ABHA fields to patients
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "abha_number" TEXT;
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "abha_address" TEXT;
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "abha_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "abha_linked_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "patients_abha_number_key" ON "patients"("abha_number");
