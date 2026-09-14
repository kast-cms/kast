-- Product gap foundations: MFA, session visibility, editorial review/locking, and media renditions.

CREATE TYPE "ContentReviewStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'CHANGES_REQUESTED');

ALTER TABLE "content_entries"
  ADD COLUMN "reviewStatus" "ContentReviewStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "submittedAt" TIMESTAMP(3),
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "lockedById" TEXT,
  ADD COLUMN "lockExpiresAt" TIMESTAMP(3);

CREATE INDEX "content_entries_reviewStatus_idx" ON "content_entries"("reviewStatus");
CREATE INDEX "content_entries_lockExpiresAt_idx" ON "content_entries"("lockExpiresAt");

ALTER TABLE "users"
  ADD COLUMN "mfaSecret" TEXT,
  ADD COLUMN "mfaEnabledAt" TIMESTAMP(3),
  ADD COLUMN "mfaRecoveryCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "refresh_tokens"
  ADD COLUMN "lastUsedAt" TIMESTAMP(3),
  ADD COLUMN "userAgent" TEXT,
  ADD COLUMN "ipAddress" TEXT;

ALTER TABLE "media_files"
  ADD COLUMN "variantSize" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "variants" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "focalPoint" JSONB,
  ADD COLUMN "deliveryTransforms" JSONB NOT NULL DEFAULT '{}';
