-- CreateTable
CREATE TABLE "Automation" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'new_response',
    "action" TEXT NOT NULL DEFAULT 'webhook',
    "config" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastFiredAt" TIMESTAMP(3),
    "lastStatus" TEXT,

    CONSTRAINT "Automation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Automation_formId_idx" ON "Automation"("formId");

-- AddForeignKey
ALTER TABLE "Automation" ADD CONSTRAINT "Automation_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;
