/*
  Warnings:

  - You are about to drop the columns `dataRegion`, `retentionDays` and `brandingHidden` on the `Organization` table. All the data in them will be lost.
  - You are about to drop the `Response` and `Event` tables. All the data in them will be lost.

*/
-- DropForeignKey
ALTER TABLE "Event" DROP CONSTRAINT "Event_formId_fkey";

-- DropForeignKey
ALTER TABLE "Response" DROP CONSTRAINT "Response_formId_fkey";

-- AlterTable
ALTER TABLE "Organization" DROP COLUMN "brandingHidden",
DROP COLUMN "dataRegion",
DROP COLUMN "retentionDays";

-- DropTable
DROP TABLE "Event";

-- DropTable
DROP TABLE "Response";

