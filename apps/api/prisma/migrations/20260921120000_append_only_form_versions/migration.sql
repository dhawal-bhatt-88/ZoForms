-- FormVersion becomes append-only: every Save inserts a new row, no row is
-- updated after insert, and a form's current version is its highest `version`.
-- The mutable draft row and the `published` flag go away.
--
-- Keep each form's current content. The single `published = false` row was the
-- live draft (always version 1); the `published = true` rows were older history
-- snapshots numbered 2+. Left in place, the highest-numbered snapshot would
-- become "current" and silently replace the draft, so drop the snapshots.
DELETE FROM "FormVersion" WHERE "published" = true;

-- DropIndex
DROP INDEX "FormVersion_formId_published_idx";

-- AlterTable
ALTER TABLE "FormVersion" DROP COLUMN "published",
ALTER COLUMN "version" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "FormVersion_formId_version_key" ON "FormVersion"("formId", "version");
