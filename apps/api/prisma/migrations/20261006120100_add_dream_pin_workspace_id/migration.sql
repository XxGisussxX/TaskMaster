-- AlterTable
-- La columna se agrega nullable, se backfillea desde el tablero y recién
-- después se vuelve NOT NULL: evita el ADD COLUMN NOT NULL que Prisma genera
-- cuando la tabla ya tiene filas.
ALTER TABLE "DreamPin" ADD COLUMN "workspaceId" TEXT;

UPDATE "DreamPin" AS pin
SET "workspaceId" = board."workspaceId"
FROM "DreamBoard" AS board
WHERE pin."boardId" = board."id";

DELETE FROM "DreamPin" WHERE "workspaceId" IS NULL;

ALTER TABLE "DreamPin" ALTER COLUMN "workspaceId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "DreamPin_workspaceId_idx" ON "DreamPin"("workspaceId");

-- AddForeignKey
ALTER TABLE "DreamPin" ADD CONSTRAINT "DreamPin_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;