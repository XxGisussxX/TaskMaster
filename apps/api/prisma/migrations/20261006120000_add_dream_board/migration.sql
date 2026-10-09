-- CreateEnum
CREATE TYPE "DreamPinType" AS ENUM ('GOAL', 'PROJECT', 'LEARNING', 'TRAVEL', 'FINANCIAL', 'HEALTH');

-- CreateEnum
CREATE TYPE "DreamPinColor" AS ENUM ('AMBER', 'ROSE', 'SKY', 'EMERALD', 'VIOLET', 'SLATE');

-- CreateTable
CREATE TABLE "DreamBoard" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Mi Tablero de Sueños',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DreamBoard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DreamPin" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "type" "DreamPinType" NOT NULL DEFAULT 'GOAL',
    "color" "DreamPinColor" NOT NULL DEFAULT 'AMBER',
    "x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DreamPin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DreamBoard_workspaceId_key" ON "DreamBoard"("workspaceId");

-- CreateIndex
CREATE INDEX "DreamPin_boardId_idx" ON "DreamPin"("boardId");

-- AddForeignKey
ALTER TABLE "DreamBoard" ADD CONSTRAINT "DreamBoard_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DreamPin" ADD CONSTRAINT "DreamPin_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "DreamBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;