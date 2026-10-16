/*
  Warnings:

  - You are about to drop the column `aiModel` on the `Organization` table. All the data in the column will be lost.
  - You are about to drop the column `anthropicApiKey` on the `Organization` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Organization" DROP COLUMN "aiModel",
DROP COLUMN "anthropicApiKey";
