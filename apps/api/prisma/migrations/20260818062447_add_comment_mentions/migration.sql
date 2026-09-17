-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "mentionedUserIds" TEXT NOT NULL DEFAULT '[]';

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
