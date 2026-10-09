-- AlterTable
ALTER TABLE "DreamPin" ADD COLUMN "createdById" TEXT;

-- CreateIndex
CREATE INDEX "DreamPin_createdById_idx" ON "DreamPin"("createdById");

-- AddForeignKey
ALTER TABLE "DreamPin" ADD CONSTRAINT "DreamPin_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;