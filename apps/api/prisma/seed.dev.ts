import {
  CustomFieldType,
  NoteType,
  Priority,
  StickyColor,
  TaskStatus,
  WorkspaceRole,
} from "@taskmaster/contracts";
import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";

if (process.env.NODE_ENV && process.env.NODE_ENV === "production") {
  throw new Error(
    "🚫 ERROR CRÍTICO: Ejecutar seed en producción está estrictamente prohibido.",
  );
}

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
  const localEmail = "demo@taskmaster.local";
  const viewerEmail = "viewer@taskmaster.app";
  const workspaceSlug = "espacio-demo";
  const seedEmails = [email, localEmail, viewerEmail];

  await prisma.workspace.deleteMany({ where: { slug: workspaceSlug } });

  // Los usuarios semilla pueden tener datos de corridas anteriores (tareas y
  // workspaces propios). Esos datos sí se borran, para que el seed sea
  // idempotente; los usuarios no, porque arrastran las sesiones del navegador.
  const previous = await prisma.user.findMany({
    where: { email: { in: seedEmails } },
    select: { id: true },
  });
  const previousIds = previous.map((u) => u.id);
  if (previousIds.length > 0) {
    await prisma.task.deleteMany({ where: { creatorId: { in: previousIds } } });
    await prisma.note.deleteMany({ where: { authorId: { in: previousIds } } });
    await prisma.workspace.deleteMany({
      where: { ownerId: { in: previousIds } },
    });
  }

  // Los usuarios semilla se actualizan en lugar de borrarse. `RefreshToken`
  // cuelga de `User` con `onDelete: Cascade`, así que un `deleteMany` acá
  // eliminaba de paso todas las filas de refresh de las cuentas demo: la cookie
  // `tm_refresh` del navegador quedaba apuntando a un token inexistente, el
  // store seguía con `user` en localStorage, y cada arranque terminaba en un
  // refresh 401. Borrar los datos de abajo alcanza para que el seed sea
  // idempotente sin tocar la sesión de nadie.
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      id: "user_demo_app",
      email,
      name: "Usuario Demo",
      passwordHash: hashPassword("password123"),
      isEmailVerified: true,
      settings: { create: { theme: "system" } },
    },
    update: {
      name: "Usuario Demo",
      passwordHash: hashPassword("password123"),
      isEmailVerified: true,
      settings: { upsert: { create: { theme: "system" }, update: {} } },
    },
  });

  // Usuarios extra que el seed SQL usa para asignaciones, comentarios y
  // colaboradores de notas. Sin ellos las subconsultas por email darían NULL.
  // Ids fijos: el seed es determinístico, así el workspace y los usuarios
  // conservan su identidad entre corridas y la sesión del navegador no expira.
  const [teamMember, viewer] = await Promise.all([
    prisma.user.upsert({
      where: { email: localEmail },
      create: {
        id: "user_demo_local",
        email: localEmail,
        name: "Demo Local",
        passwordHash: hashPassword("password123"),
        isEmailVerified: true,
        settings: { create: { theme: "system" } },
      },
      update: {
        name: "Demo Local",
        passwordHash: hashPassword("password123"),
        isEmailVerified: true,
        settings: { upsert: { create: { theme: "system" }, update: {} } },
      },
    }),
    prisma.user.upsert({
      where: { email: viewerEmail },
      create: {
        id: "user_viewer",
        email: viewerEmail,
        name: "Viewer Demo",
        passwordHash: hashPassword("password123"),
        isEmailVerified: true,
        settings: { create: { theme: "system" } },
      },
      update: {
        name: "Viewer Demo",
        passwordHash: hashPassword("password123"),
        isEmailVerified: true,
        settings: { upsert: { create: { theme: "system" }, update: {} } },
      },
    }),
  ]);

  const workspace = await prisma.workspace.create({
    data: {
      id: "workspace_demo",
      name: "Espacio Demo",
      slug: workspaceSlug,
      ownerId: user.id,
      members: {
        create: [
          { userId: user.id, role: WorkspaceRole.OWNER },
          { userId: teamMember.id, role: WorkspaceRole.ADMIN },
          { userId: viewer.id, role: WorkspaceRole.VIEWER },
        ],
      },
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

  console.log("Tags:", {
    urgente: urgente.id,
    trabajo: trabajo.id,
    personal: personal.id,
  });

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

  console.log("Categories:", {
    desarrollo: desarrollo.id,
    diseno: diseno.id,
    administracion: administracion.id,
  });

  // Definiciones de custom fields que el seed SQL rellena con valores.
  await prisma.customFieldDefinition.createMany({
    data: [
      {
        workspaceId,
        name: "Prioridad venta",
        type: CustomFieldType.SELECT,
        options: ["Alta", "Media", "Baja"],
        order: 0,
      },
      {
        workspaceId,
        name: "Es recurrente",
        type: CustomFieldType.CHECKBOX,
        order: 1,
      },
      {
        workspaceId,
        name: "Presupuesto",
        type: CustomFieldType.NUMBER,
        order: 2,
      },
    ],
  });

  const tasks: any[] = [];

  console.log("Creating task 1");
  const t1 = await prisma.task.create({
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
    },
  });
  console.log("Created t1", t1.id);
  tasks.push(t1);

  console.log("Creating task 2");
  const t2 = await prisma.task.create({
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
    },
  });
  console.log("Created t2", t2.id);
  tasks.push(t2);

  console.log("Creating task 3");
  const t3 = await prisma.task.create({
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
    },
  });
  console.log("Created t3", t3.id);
  tasks.push(t3);

  console.log("Creating task 4");
  const t4 = await prisma.task.create({
    data: {
      workspaceId,
      creatorId: user.id,
      title: "Comprar el regalo de cumpleaños",
      status: TaskStatus.TODO,
      priority: Priority.MEDIUM,
      dueDate: daysFromNow(5),
      order: 4,
      // no category for this task
    },
  });
  console.log("Created t4", t4.id);
  tasks.push(t4);

  console.log("Creating task 5");
  const t5 = await prisma.task.create({
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
  });
  console.log("Created t5", t5.id);
  tasks.push(t5);

  console.log("Creating task 6");
  const t6 = await prisma.task.create({
    data: {
      workspaceId,
      creatorId: user.id,
      title: "Revisar backlog archivado",
      status: TaskStatus.ARCHIVED,
      priority: Priority.LOW,
      dueDate: daysFromNow(-14),
      order: 6,
      categoryId: administracion.id,
    },
  });
  console.log("Created t6", t6.id);
  tasks.push(t6);

  console.log("Creating task 7");
  const t7 = await prisma.task.create({
    data: {
      workspaceId,
      creatorId: user.id,
      title: "Migrar TaskMaster v3",
      status: TaskStatus.IN_PROGRESS,
      priority: Priority.URGENT,
      dueDate: daysFromNow(7),
      order: 7,
      categoryId: desarrollo.id,
    },
  });
  console.log("Created t7", t7.id);
  tasks.push(t7);

  // Crear explicitamente las asociaciones TaskTag para evitar errores de FK
  await Promise.all([
    prisma.taskTag.create({ data: { taskId: tasks[0].id, tagId: trabajo.id } }),
    prisma.taskTag.create({ data: { taskId: tasks[1].id, tagId: urgente.id } }),
    prisma.taskTag.create({ data: { taskId: tasks[2].id, tagId: trabajo.id } }),
    prisma.taskTag.create({
      data: { taskId: tasks[3].id, tagId: personal.id },
    }),
  ]);

  const subtaskParent = tasks[6];
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
    prisma.note.create({
      data: {
        workspaceId,
        authorId: user.id,
        type: NoteType.IDEA,
        title: "Idea de producto",
        content: "Permitir plantillas de tareas repetitivas por proyecto.",
        color: StickyColor.BLUE,
      },
    }),
    prisma.note.create({
      data: {
        workspaceId,
        authorId: user.id,
        type: NoteType.MEETING,
        title: "Reunión de kickoff",
        content: "Definir alcance, métricas y responsables del sprint inicial.",
        color: StickyColor.GREEN,
        pinned: true,
      },
    }),
  ]);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
