/*
  Warnings:

  - You are about to drop the `Domain` table. All the data in it will be lost.

*/
-- DropForeignKey
ALTER TABLE "Domain" DROP CONSTRAINT "Domain_orgId_fkey";

-- DropTable
DROP TABLE "Domain";
