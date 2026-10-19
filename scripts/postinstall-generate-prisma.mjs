// `postinstall` de la raíz: genera el Prisma Client solo si el schema existe.
//
// En un checkout normal (y en CI) el schema está y esto genera el client, que es
// lo que necesita `tsc` para tipar. En la etapa `deps` de las imágenes Docker
// solo hay manifiestos (sin código fuente ni schema), así que se omite: ahí el
// `prisma generate` real corre más tarde, en la etapa `build`, con el schema ya
// copiado.
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const schema = join(root, "apps", "api", "prisma", "schema.prisma");

if (!existsSync(schema)) {
  console.log(
    "[postinstall] apps/api/prisma/schema.prisma no está presente; omito prisma generate",
  );
  process.exit(0);
}

const result = spawnSync(
  "pnpm",
  ["--filter", "@taskmaster/api", "prisma:generate"],
  {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);
process.exit(result.status ?? 1);
