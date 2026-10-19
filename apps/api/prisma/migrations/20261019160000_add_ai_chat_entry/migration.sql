-- CreateTable
-- Historial del asistente IA por usuario/workspace. Sustituye el estado
-- efímero en memoria del frontend, que se perdía al recargar la página.
CREATE TABLE "AiChatEntry" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "actions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiChatEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiChatEntry_workspaceId_userId_createdAt_idx" ON "AiChatEntry"("workspaceId", "userId", "createdAt");

-- AddForeignKey
ALTER TABLE "AiChatEntry" ADD CONSTRAINT "AiChatEntry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiChatEntry" ADD CONSTRAINT "AiChatEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
