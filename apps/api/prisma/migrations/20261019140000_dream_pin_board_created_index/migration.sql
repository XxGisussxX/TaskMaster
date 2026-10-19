-- CreateIndex
-- El tablero ordena los pins por `createdAt` dentro de un `boardId`
-- (`BOARD_INCLUDE`); el índice previo era solo por `boardId`, así que el
-- `orderBy` seguía ordenando en memoria. Compuesto cubre filtro y orden.
CREATE INDEX "DreamPin_boardId_createdAt_idx" ON "DreamPin"("boardId", "createdAt");

-- DropIndex
DROP INDEX "DreamPin_boardId_idx";
