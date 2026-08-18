const { randomBytes, scryptSync } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");

const salt = randomBytes(16).toString("hex");
const key = scryptSync("password123", salt, 64);
const hash = `scrypt$${salt}$${key.toString("hex")}`;

const p = new PrismaClient();
(async () => {
  const user = await p.user.update({
    where: { email: "demo@taskmaster.local" },
    data: { passwordHash: hash },
  });
  console.log("Actualizado:", user.email, user.name);
  await p.$disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
