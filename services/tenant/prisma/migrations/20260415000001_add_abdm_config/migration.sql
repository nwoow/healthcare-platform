-- AlterTable: add ABDM config fields to tenant_configs
ALTER TABLE "tenant_configs" ADD COLUMN IF NOT EXISTS "abdm_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tenant_configs" ADD COLUMN IF NOT EXISTS "abdm_facility_id" TEXT;
ALTER TABLE "tenant_configs" ADD COLUMN IF NOT EXISTS "abdm_hip_id" TEXT;
ALTER TABLE "tenant_configs" ADD COLUMN IF NOT EXISTS "abdm_hiu_id" TEXT;
ALTER TABLE "tenant_configs" ADD COLUMN IF NOT EXISTS "abdm_sandbox_mode" BOOLEAN NOT NULL DEFAULT true;
