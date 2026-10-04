-- Renombra Category -> Channel.
--
-- Se hace con RENAME en lugar de DROP + CREATE a propósito: `ALTER TABLE ... RENAME`
-- conserva los datos fila por fila y mantiene los índices y constraints
-- asociados. Recrear la tabla exigiría copiar los datos a mano y abriría la
-- puerta a perderlos justo en el paso donde más caro sale equivocarse.
--
-- El orden importa: primero la FK que depende de la columna, después la tabla y
-- por último la columna. Si se renombra la tabla antes, la FK queda apuntando al
-- nombre viejo y el rename de la columna no la encuentra.

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_categoryId_fkey";

-- AlterTable
ALTER TABLE "Category" RENAME TO "Channel";

-- AlterTable
ALTER TABLE "Task" RENAME COLUMN "categoryId" TO "channelId";

-- RenameIndex
-- El índice único de (workspaceId, name) es el que impide dos canales con el
-- mismo nombre en un workspace; si se dejara con el nombre viejo, Prisma lo
-- seguiría esperando con el nombre nuevo y la validación de drift no cerraría.
ALTER INDEX "Category_workspaceId_name_key" RENAME TO "Channel_workspaceId_name_key";

-- RenameConstraint
-- La primary key es un constraint, no un índice suelto: se renombra con
-- RENAME CONSTRAINT. `ALTER TABLE ... RENAME TO` no la toca, así que sin esto
-- quedaría un "Category_pkey" colgando sobre una tabla llamada "Channel" y la
-- validación de drift de Prisma no cerraría.
ALTER TABLE "Channel" RENAME CONSTRAINT "Category_pkey" TO "Channel_pkey";

-- AddForeignKey
-- ON DELETE SET NULL se conserva a propósito: borrar un canal no debe borrar en
-- cascada las tareas que lo tenían asignado, solo dejarlas sin canal.
ALTER TABLE "Task" ADD CONSTRAINT "Task_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameConstraint
-- Va sobre "Channel", no sobre "Workspace": la constraint pertenece a la tabla
-- que tenía la FK hacia Workspace, y Postgres no la encuentra si se le pide el
-- rename sobre otra tabla.
ALTER TABLE "Channel" RENAME CONSTRAINT "Category_workspaceId_fkey" TO "Channel_workspaceId_fkey";