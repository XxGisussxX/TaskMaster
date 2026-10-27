-- Las cuentas creadas con Google heredaban la foto de perfil de Google.
-- El producto usa las iniciales por defecto (igual que una cuenta registrada
-- con email) y la foto es opt-in desde Ajustes, así que se limpian solo los
-- avatares que apuntan al CDN de Google en usuarios con una cuenta vinculada.
-- Una foto subida a mano no matchea el host y se conserva.
UPDATE "User" AS u
SET "avatarUrl" = NULL
WHERE u."avatarUrl" ILIKE '%googleusercontent.com%'
  AND EXISTS (
    SELECT 1
    FROM "Account" AS a
    WHERE a."userId" = u."id"
      AND a."provider" = 'google'
  );
