-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "dueSoNotifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Task_dueDate_dueSoNotifiedAt_idx" ON "Task"("dueDate", "dueSoNotifiedAt");
