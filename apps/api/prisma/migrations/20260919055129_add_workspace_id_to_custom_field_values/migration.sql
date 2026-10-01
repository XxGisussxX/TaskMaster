-- DropIndex
DROP INDEX "CustomFieldValue_entityId_entityType_idx";

-- AlterTable
-- Agregamos la columna nullable para poder backfillear desde la definición.
ALTER TABLE "CustomFieldValue" ADD COLUMN     "workspaceId" TEXT;

-- Backfill: cada valor hereda el workspace de su definición (origen de la verdad).
UPDATE "CustomFieldValue" v
SET "workspaceId" = d."workspaceId"
FROM "CustomFieldDefinition" d
WHERE v."definitionId" = d."id";

-- Valores huérfanos (sin definición) no pueden quedar sin propietario:
-- su definición fue eliminada y su dato no es legible de forma segura.
DELETE FROM "CustomFieldValue" v
WHERE v."workspaceId" IS NULL;

-- Con los datos ya asignados, la columna puede ser NOT NULL.
ALTER TABLE "CustomFieldValue" ALTER COLUMN "workspaceId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "CustomFieldValue_workspaceId_entityId_entityType_idx" ON "CustomFieldValue"("workspaceId", "entityId", "entityType");

-- CreateIndex
CREATE INDEX "CustomFieldValue_workspaceId_definitionId_idx" ON "CustomFieldValue"("workspaceId", "definitionId");

-- AddForeignKey
ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;