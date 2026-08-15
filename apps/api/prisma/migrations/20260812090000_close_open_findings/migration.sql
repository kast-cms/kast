-- Preserve account suspension across trash/restore and make public schema
-- discovery explicit instead of exposing every content model.
ALTER TABLE "users" ADD COLUMN "preTrashIsActive" BOOLEAN;
UPDATE "users" SET "preTrashIsActive" = TRUE WHERE "trashedAt" IS NOT NULL;

ALTER TABLE "content_types"
  ADD COLUMN "isPubliclyDiscoverable" BOOLEAN NOT NULL DEFAULT FALSE;

-- The documented media metadata field is now a real column.
ALTER TABLE "media_files" ADD COLUMN "caption" TEXT;
ALTER TABLE "media_files"
  ADD COLUMN "originalStorageKey" TEXT,
  ADD COLUMN "originalUrl" TEXT,
  ADD COLUMN "originalSize" INTEGER,
  ADD COLUMN "optimizedSize" INTEGER,
  ADD COLUMN "thumbnailSize" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "thumbnails" JSONB NOT NULL DEFAULT '{}';
UPDATE "media_files" SET
  "originalStorageKey" = "storageKey",
  "originalUrl" = "url",
  "originalSize" = "size";

DROP TABLE IF EXISTS "ai_content_generations";
DROP TABLE IF EXISTS "ai_image_generations";
DROP TYPE IF EXISTS "AiJobStatus";
DROP TYPE IF EXISTS "AiTriggerType";

ALTER TABLE "agent_sessions"
  ADD COLUMN "durationMs" INTEGER,
  ADD COLUMN "outcome" TEXT;

ALTER TABLE "plugins"
  ADD COLUMN "isInstalled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "manifest" JSONB NOT NULL DEFAULT '{}';

INSERT INTO "global_settings" ("id", "key", "value", "group", "label", "isPublic", "updatedAt")
SELECT 'migrated-site-name', 'site.name', "value", 'site', "label", true, NOW()
FROM "global_settings" WHERE "key" = 'site_name'
ON CONFLICT ("key") DO NOTHING;
DELETE FROM "global_settings" WHERE "key" IN ('site_name', 'default_locale');

-- Keep authored content and audit history when a retained user is permanently
-- purged. Attribution becomes null rather than blocking retention forever.
ALTER TABLE "content_entries" ALTER COLUMN "createdById" DROP NOT NULL;
ALTER TABLE "content_entry_versions" ALTER COLUMN "savedById" DROP NOT NULL;
ALTER TABLE "redirects" ALTER COLUMN "createdById" DROP NOT NULL;
ALTER TABLE "media_files" ALTER COLUMN "uploadedById" DROP NOT NULL;

ALTER TABLE "content_entries" DROP CONSTRAINT "content_entries_createdById_fkey";
ALTER TABLE "content_entries"
  ADD CONSTRAINT "content_entries_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "content_entry_versions" DROP CONSTRAINT "content_entry_versions_savedById_fkey";
ALTER TABLE "content_entry_versions"
  ADD CONSTRAINT "content_entry_versions_savedById_fkey"
  FOREIGN KEY ("savedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "redirects" DROP CONSTRAINT "redirects_createdById_fkey";
ALTER TABLE "redirects"
  ADD CONSTRAINT "redirects_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "media_files" DROP CONSTRAINT "media_files_uploadedById_fkey";
ALTER TABLE "media_files"
  ADD CONSTRAINT "media_files_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
