import {
  NoteType,
  Priority,
  StickyColor,
  TaskStatus,
  WorkspaceRole,
} from "@taskmaster/contracts";
import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(plain, salt, 64);
  return `scrypt$${salt}$${key.toString("hex")}`;
}

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

async function main(): Promise<void> {
  const email = "demo@taskmaster.app";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Seed: ya existe el usuario demo, saltando.");
    return;
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: "Usuario Demo",
      passwordHash: hashPassword("password123"),
      isEmailVerified: true,
      settings: { create: { theme: "system" } },
    },
  });

  const workspace = await prisma.workspace.create({
    data: {
      name: "Espacio Demo",
      slug: "espacio-demo",
      ownerId: user.id,
      members: { create: { userId: user.id, role: WorkspaceRole.OWNER } },
    },
  });

  const workspaceId = workspace.id;

  const [urgente, trabajo, personal] = await Promise.all([
    prisma.tag.create({
      data: { workspaceId, name: "Urgente", color: "#ef4444" },
    }),
    prisma.tag.create({
      data: { workspaceId, name: "Trabajo", color: "#3b82f6" },
    }),
    prisma.tag.create({
      data: { workspaceId, name: "Personal", color: "#22c55e" },
    }),
  ]);

  const [desarrollo, diseno, administracion] = await Promise.all([
    prisma.category.create({
      data: { workspaceId, name: "Desarrollo", color: "#3b82f6" },
    }),
    prisma.category.create({
      data: { workspaceId, name: "Diseño", color: "#a855f7" },
    }),
    prisma.category.create({
      data: { workspaceId, name: "Administración", color: "#eab308" },
    }),
  ]);

  const tasks = await Promise.all([
    prisma.task.create({
      data: {
        workspaceId,
        creatorId: user.id,
        title: "Configurar monorepo con pnpm",
        description: "pnpm-workspace.yaml + packages compartidos",
        status: TaskStatus.DONE,
        priority: Priority.HIGH,
        order: 1,
        categoryId: desarrollo.id,
        completedAt: new Date(Date.now() - 3 * 86_400_000),
        tags: { create: [{ tagId: trabajo.id }] },
      },
    }),
    prisma.task.create({
      data: {
        workspaceId,
        creatorId: user.id,
        title: "Diseñar la página de dashboard",
        description: "KPIs + gráfico de actividad",
        status: TaskStatus.IN_PROGRESS,
        priority: Priority.URGENT,
        dueDate: daysFromNow(1),
        order: 2,
        categoryId: diseno.id,
        tags: { create: [{ tagId: urgente.id }] },
      },
    }),
    prisma.task.create({
      data: {
        workspaceId,
        creatorId: user.id,
        title: "Implementar autenticación JWT",
        description: "Access + refresh con rotación",
        status: TaskStatus.IN_REVIEW,
        priority: Priority.HIGH,
        dueDate: daysFromNow(2),
        order: 3,
        categoryId: desarrollo.id,
        tags: { create: [{ tagId: trabajo.id }] },
      },
    }),
    prisma.task.create({
      data: {
        workspaceId,
        creatorId: user.id,
        title: "Comprar el regalo de cumpleaños",
        status: TaskStatus.TODO,
        priority: Priority.MEDIUM,
        dueDate: daysFromNow(5),
        order: 4,
        categoryId: personal.id,
        tags: { create: [{ tagId: personal.id }] },
      },
    }),
    prisma.task.create({
      data: {
        workspaceId,
        creatorId: user.id,
        title: "Pagar la factura de internet",
        status: TaskStatus.TODO,
        priority: Priority.MEDIUM,
        dueDate: daysFromNow(-1),
        order: 5,
        categoryId: administracion.id,
      },
    }),
    prisma.task.create({
      data: {
        workspaceId,
        creatorId: user.id,
        title: "Migrar TaskMaster v3",
        status: TaskStatus.IN_PROGRESS,
        priority: Priority.URGENT,
        dueDate: daysFromNow(7),
        order: 6,
        categoryId: desarrollo.id,
      },
    }),
  ]);

  const subtaskParent = tasks[5];
  if (subtaskParent) {
    await prisma.task.create({
      data: {
        workspaceId,
        creatorId: user.id,
        title: "Crear schema de Prisma",
        status: TaskStatus.DONE,
        priority: Priority.HIGH,
        parentId: subtaskParent.id,
        order: 1,
        completedAt: new Date(),
      },
    });
    await prisma.task.create({
      data: {
        workspaceId,
        creatorId: user.id,
        title: "Levantar endpoints de tareas",
        status: TaskStatus.IN_PROGRESS,
        priority: Priority.HIGH,
        parentId: subtaskParent.id,
        order: 2,
      },
    });
  }

  await Promise.all([
    prisma.note.create({
      data: {
        workspaceId,
        authorId: user.id,
        type: NoteType.STANDARD,
        title: "Ideas para el dashboard",
        content: "Mostrar heatmap anual y tendencia de 30 días.",
        pinned: true,
        tags: { create: [{ name: "idea" }] },
      },
    }),
    prisma.note.create({
      data: {
        workspaceId,
        authorId: user.id,
        type: NoteType.CHECKLIST,
        title: "Lanzamiento",
        items: {
          create: [
            { text: "Migraciones de Prisma", done: true, order: 0 },
            { text: "Autenticación", done: false, order: 1 },
            { text: "Deploy", done: false, order: 2 },
          ],
        },
      },
    }),
    prisma.note.create({
      data: {
        workspaceId,
        authorId: user.id,
        type: NoteType.STICKY,
        content: "Recordar renunciar al café de la tarde",
        color: StickyColor.YELLOW,
      },
    }),
  ]);

  console.log(
    `Seed completado. Login: demo@taskmaster.app / password123 (workspace: ${workspaceId})`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
