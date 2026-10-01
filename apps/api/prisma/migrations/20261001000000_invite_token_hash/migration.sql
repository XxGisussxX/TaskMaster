-- Migramos el token de invitación a hash: un dump de la base no debe servir
-- para redimir invitaciones. Antes bastaba el token en claro (más el email
-- destinatario) para entrar a un workspace; ahora la DB solo guarda el SHA-256.

-- AddColumn
ALTER TABLE "Invite" ADD COLUMN "tokenHash" TEXT;

-- Backfill con el mismo SHA-256 que aplica la app al generar el token
-- (createHash("sha256").update(token).digest("hex")). Verificado: para la misma
-- entrada, sha256() de Postgres y node:crypto devuelven el mismo hex.
--
-- Consecuencia: los links de invitación YA enviados dejan de funcionar, porque
-- el token en claro que contienen ya no se puede volver a calcular contra el
-- hash almacenado. Se reenvían desde la pestaña de invitaciones.
UPDATE "Invite"
SET "tokenHash" = encode(sha256(convert_to("token", 'UTF8')), 'hex');

-- Una invitación sin hash no se puede redimir ni auditar: no queda dato útil.
DELETE FROM "Invite" WHERE "tokenHash" IS NULL;

-- AlterTable
ALTER TABLE "Invite" ALTER COLUMN "tokenHash" SET NOT NULL;

-- DropIndex: el único estaba sobre la columna en claro, que ya no existe
DROP INDEX "Invite_token_key";

-- DropColumn
ALTER TABLE "Invite" DROP COLUMN "token";

-- CreateIndex
CREATE UNIQUE INDEX "Invite_tokenHash_key" ON "Invite"("tokenHash");
