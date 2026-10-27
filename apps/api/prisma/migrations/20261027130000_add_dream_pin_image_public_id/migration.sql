-- D3: el pin guarda el `public_id` de Cloudinary junto a la URL.
--
-- Antes el borrado del asset derivaba el id desde `imageUrl` con un regex; eso
-- se rompe si Cloudinary cambia el formato de entrega. Es nullable porque los
-- pins viejos no lo tienen (el servicio cae al fallback) y porque el modo sin
-- Cloudinary guarda `data:` base64, que no tiene public_id.
ALTER TABLE "DreamPin" ADD COLUMN "imagePublicId" TEXT;
