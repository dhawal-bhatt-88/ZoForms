-- Tokens issued before this time are refused (password reset, Google claiming an unverified account).
ALTER TABLE "User" ADD COLUMN "sessionsValidFrom" TIMESTAMP(3);
