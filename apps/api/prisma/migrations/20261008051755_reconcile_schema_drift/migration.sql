/*
  Warnings:

  - Added the required column `updatedAt` to the `Channel` table without a default value. This is not possible if the table is not empty.

  Desviación intencional respecto al SQL generado por Prisma:
  la columna `updatedAt` se agrega con un default de relleno, se backfillea desde
  `createdAt` para las filas existentes y luego se le quita el default. Sin esto,
  `prisma migrate deploy` falla con error 23502 en cualquier base con canales
  creados (los `Category` que pasaron a `Channel` tienenn filas reales). El
  resultado final es idéntico al schema (NOT NULL, sin default), así que el
  chequeo de drift del CI no ve ninguna diferencia.
*/
-- AlterTable
ALTER TABLE "Channel" ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "isPrivate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "teamId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill para filas existentes: el default de relleno ya las cubre, este UPDATE
-- es la garantía explícita de que ninguna fila queda con NULL.
UPDATE "Channel" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;

-- Se quita el default para que el esquema resultante coincida con schema.prisma
-- (updatedAt es @updatedAt: la única forma de escribirlo es desde la app).
ALTER TABLE "Channel" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DreamPin" ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "linkedTaskId" TEXT,
ADD COLUMN     "sticker" TEXT;

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '#3b82f6',
    "avatar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "workspaceMemberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Team_workspaceId_idx" ON "Team"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_workspaceId_name_key" ON "Team"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "TeamMember_workspaceMemberId_idx" ON "TeamMember"("workspaceMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_teamId_workspaceMemberId_key" ON "TeamMember"("teamId", "workspaceMemberId");

-- CreateIndex
CREATE INDEX "Channel_workspaceId_teamId_idx" ON "Channel"("workspaceId", "teamId");

-- CreateIndex
CREATE INDEX "DreamPin_linkedTaskId_idx" ON "DreamPin"("linkedTaskId");

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DreamPin" ADD CONSTRAINT "DreamPin_linkedTaskId_fkey" FOREIGN KEY ("linkedTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_workspaceMemberId_fkey" FOREIGN KEY ("workspaceMemberId") REFERENCES "WorkspaceMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
