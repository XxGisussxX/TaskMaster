-- CreateIndex
CREATE INDEX "Task_workspaceId_completedAt_idx" ON "Task"("workspaceId", "completedAt");

-- CreateIndex
CREATE INDEX "Task_workspaceId_createdAt_idx" ON "Task"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "TimeEntry_workspaceId_startedAt_idx" ON "TimeEntry"("workspaceId", "startedAt");
