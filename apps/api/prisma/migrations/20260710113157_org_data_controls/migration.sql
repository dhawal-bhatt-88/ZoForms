-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "brandingHidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dataRegion" TEXT NOT NULL DEFAULT 'us',
ADD COLUMN     "retentionDays" INTEGER NOT NULL DEFAULT 0;

