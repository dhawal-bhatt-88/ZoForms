/*
  Warnings:

  - You are about to drop the `Automation` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Automation" DROP CONSTRAINT "Automation_formId_fkey";

-- DropTable
DROP TABLE "Automation";
