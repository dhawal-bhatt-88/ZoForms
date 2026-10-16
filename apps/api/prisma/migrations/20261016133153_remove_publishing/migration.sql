/*
  Warnings:

  - You are about to drop the column `slug` on the `Form` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Form` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Form_slug_key";

-- AlterTable
ALTER TABLE "Form" DROP COLUMN "slug",
DROP COLUMN "status";

-- DropEnum
DROP TYPE "FormStatus";

