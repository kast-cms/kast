-- MFA fields follow the already-published product-gap migration.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "twoFactorLastCounter" INTEGER,
  ADD COLUMN IF NOT EXISTS "twoFactorRecoveryCodes" TEXT,
  ADD COLUMN IF NOT EXISTS "twoFactorSecret" TEXT;

-- Preserve existing authenticator enrollments and unused Argon2 recovery hashes.
UPDATE "users" SET
  "twoFactorSecret" = "mfaSecret",
  "twoFactorEnabled" = true,
  "twoFactorRecoveryCodes" = to_json("mfaRecoveryCodes")::text
WHERE "mfaSecret" IS NOT NULL AND "mfaEnabledAt" IS NOT NULL AND "twoFactorEnabled" = false;
