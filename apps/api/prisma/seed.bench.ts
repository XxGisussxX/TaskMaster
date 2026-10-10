/**
 * Siembra de datos para el benchmark de escalabilidad (FASE 2 · punto A).
 *
 * Crea TRES workspaces en la base apuntada por DATABASE_URL (debe ser una base
 * DESECHABLE, no `taskmaster`):
 *
 *   - bench-1k   →    1.000 tareas ·   2.000 time-entries
 *   - bench-10k  →   10.000 tareas ·  20.000 time-entries
 *   - bench-50k  →   50.000 tareas · 200.000 time-entries
 *
 * La distribución es determinista (PRNG con semilla fija) para que las rondas
 * antes/después midan sobre exactamente los mismos datos.
 *
 * Uso:
 *   $env:DATABASE_URL = "postgresql://taskmaster:taskmaster@localhost:5433/taskmaster_bench?schema=public"
 *   pnpm --filter @taskmaster/api prisma:seed:bench
 */
import {
  PrismaClient,
  Priority,
  TaskStatus,
  WorkspaceRole,
} from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";

if (process.env.NODE_ENV === "production") {
  throw new Error("🚫 El seed de benchmark no corre en producción.");
}

const prisma = new PrismaClient();

function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(plain, salt, 64);
  return `scrypt$${salt}$${key.toString("hex")}`;
}

// PRNG determinista (mulberry32): la misma semilla produce los mismos datos.
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261010);
const randInt = (min: number, max: number) =>
  min + Math.floor(rnd() * (max - min + 1));
const pick = <T>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]!;

function weighted<T>(pairs: [T, number][]): T {
  const total = pairs.reduce((sum, [, w]) => sum + w, 0);
  let roll = rnd() * total;
  for (const [value, weight] of pairs) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return pairs[pairs.length - 1]![0];
}

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const taskDaysAgo = (n: number) => new Date(now - n * DAY);

async function createManyChunked<T>(
  create: (data: T[]) => Promise<unknown>,
  rows: T[],
  chunk = 5000,
): Promise<void> {
  for (let i = 0; i < rows.length; i += chunk) {
    await create(rows.slice(i, i + chunk));
  }
}

const STATUS_WEIGHTS: [TaskStatus, number][] = [
  [TaskStatus.DONE, 45],
  [TaskStatus.TODO, 22],
  [TaskStatus.IN_PROGRESS, 17],
  [TaskStatus.IN_REVIEW, 11],
  [TaskStatus.ARCHIVED, 5],
];
const PRIORITY_WEIGHTS: [Priority, number][] = [
  [Priority.URGENT, 12],
  [Priority.HIGH, 28],
  [Priority.MEDIUM, 35],
  [Priority.LOW, 25],
];

interface UserRow {
  id: string;
  email: string;
  name: string;
}

async function seedUsers(): Promise<UserRow[]> {
  const users: UserRow[] = [];
  for (let i = 0; i < 8; i++) {
    const email = `bench${i}@taskmaster.app`;
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        name: `Bench User ${i}`,
        passwordHash: hashPassword("password123"),
        isEmailVerified: true,
      },
      update: {
        name: `Bench User ${i}`,
        passwordHash: hashPassword("password123"),
        isEmailVerified: true,
      },
    });
    users.push({ id: user.id, email, name: user.name });
  }
  return users;
}

interface ScaleSpec {
  slug: string;
  tasks: number;
  timeEntries: number;
}

async function seedWorkspace(spec: ScaleSpec, users: UserRow[]): Promise<void> {
  await prisma.workspace.deleteMany({ where: { slug: spec.slug } });

  const owner = users[0]!;
  const workspace = await prisma.workspace.create({
    data: {
      name: `Benchmark ${spec.slug}`,
      slug: spec.slug,
      ownerId: owner.id,
      members: {
        create: users.map((u, i) => ({
          userId: u.id,
          role:
            i === 0
              ? WorkspaceRole.OWNER
              : i === 1
                ? WorkspaceRole.ADMIN
                : i === 7
                  ? WorkspaceRole.VIEWER
                  : WorkspaceRole.MEMBER,
        })),
      },
    },
  });
  const workspaceId = workspace.id;

  // Tags y canales del workspace (nombres realistas).
  const tagNames = [
    "bug",
    "feature",
    "diseño",
    "backend",
    "frontend",
    "docs",
    "urgente",
    "deuda-técnica",
    "revisión",
    "qa",
    "infra",
    "research",
  ];
  const channelNames = [
    "general",
    "producto",
    "ingeniería",
    "diseño",
    "soporte",
    "marketing",
    "operaciones",
    "research",
  ];
  const tags = await Promise.all(
    tagNames.map((name) =>
      prisma.tag.create({ data: { workspaceId, name, color: "#3b82f6" } }),
    ),
  );
  const channels = await Promise.all(
    channelNames.map((name) =>
      prisma.channel.create({ data: { workspaceId, name } }),
    ),
  );

  const tasks: {
    id: string;
    title: string;
    status: TaskStatus;
    priority: Priority;
    createdAt: Date;
    updatedAt: Date;
    dueDate: Date | null;
    completedAt: Date | null;
    channelId: string | null;
    creatorId: string;
    order: number;
    tagIds: string[];
    assigneeIds: string[];
  }[] = [];

  for (let n = 0; n < spec.tasks; n++) {
    const id = `bt_${spec.slug}_${n}`;
    const status = weighted(STATUS_WEIGHTS);
    const priority = weighted(PRIORITY_WEIGHTS);
    const createdAt = taskDaysAgo(randInt(0, 364));
    const channelId = rnd() < 0.85 ? pick(channels).id : null;

    let dueDate: Date | null;
    if (status === TaskStatus.ARCHIVED) {
      dueDate = rnd() < 0.5 ? taskDaysAgo(randInt(30, 300)) : null;
    } else if (status === TaskStatus.DONE) {
      dueDate = taskDaysAgo(randInt(0, 300));
    } else {
      const bucket = rnd();
      if (bucket < 0.3)
        dueDate = taskDaysAgo(randInt(1, 90)); // vencidas
      else if (bucket < 0.65) dueDate = new Date(now + randInt(0, 14) * DAY);
      else if (bucket < 0.9) dueDate = new Date(now + randInt(15, 60) * DAY);
      else dueDate = null;
    }

    let completedAt: Date | null = null;
    if (status === TaskStatus.DONE) {
      const base = dueDate ?? createdAt;
      const delta = randInt(0, 20) * DAY + randInt(0, 20) * 3600 * 1000;
      completedAt = new Date(
        Math.min(now, Math.max(createdAt.getTime(), base.getTime() + delta)),
      );
    }

    const tagCount = randInt(1, 3);
    const tagIds = Array.from(
      new Set(Array.from({ length: tagCount }, () => pick(tags).id)),
    );
    const assigneeIds =
      rnd() < 0.9
        ? Array.from(
            new Set(
              Array.from({ length: randInt(1, 3) }, () => pick(users).id),
            ),
          )
        : [];

    tasks.push({
      id,
      title: `Benchmark task ${n}`,
      status,
      priority,
      createdAt,
      updatedAt: createdAt,
      dueDate,
      completedAt,
      channelId,
      creatorId: pick(users).id,
      order: n,
      tagIds,
      assigneeIds,
    });
  }

  await createManyChunked(
    (data) => prisma.task.createMany({ data, skipDuplicates: true }),
    tasks.map((t) => ({
      id: t.id,
      workspaceId,
      creatorId: t.creatorId,
      title: t.title,
      description: "",
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      completedAt: t.completedAt,
      channelId: t.channelId,
      order: t.order,
    })),
  );

  const taskTags = tasks.flatMap((t) =>
    t.tagIds.map((tagId) => ({ taskId: t.id, tagId })),
  );
  await createManyChunked(
    (data) => prisma.taskTag.createMany({ data, skipDuplicates: true }),
    taskTags,
  );

  const taskAssignees = tasks.flatMap((t) =>
    t.assigneeIds.map((userId) => ({ taskId: t.id, userId })),
  );
  await createManyChunked(
    (data) => prisma.taskAssignee.createMany({ data, skipDuplicates: true }),
    taskAssignees,
  );

  const taskIds = tasks.map((t) => t.id);
  const timeEntries: {
    id: string;
    workspaceId: string;
    taskId: string;
    userId: string;
    description: string;
    startedAt: Date;
    stoppedAt: Date;
    duration: number;
    createdAt: Date;
  }[] = [];
  for (let n = 0; n < spec.timeEntries; n++) {
    const startedAt = new Date(now - rnd() * 180 * DAY);
    const duration = randInt(300, 28_800);
    timeEntries.push({
      id: `bte_${spec.slug}_${n}`,
      workspaceId,
      taskId: pick(taskIds),
      userId: pick(users).id,
      description: "",
      startedAt,
      stoppedAt: new Date(startedAt.getTime() + duration * 1000),
      duration,
      createdAt: startedAt,
    });
  }
  await createManyChunked(
    (data) => prisma.timeEntry.createMany({ data, skipDuplicates: true }),
    timeEntries,
  );

  console.log(
    `✔ ${spec.slug}: ${spec.tasks} tareas, ${timeEntries.length} time-entries (workspace ${workspaceId})`,
  );
}

async function main(): Promise<void> {
  const started = Date.now();
  const users = await seedUsers();

  const specs: ScaleSpec[] = [
    { slug: "bench-1k", tasks: 1_000, timeEntries: 2_000 },
    { slug: "bench-10k", tasks: 10_000, timeEntries: 20_000 },
    { slug: "bench-50k", tasks: 50_000, timeEntries: 200_000 },
  ];

  for (const spec of specs) {
    await seedWorkspace(spec, users);
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  const mem = process.memoryUsage();
  console.log(
    `\nSeed de benchmark completo en ${elapsed}s · RSS pico ≈ ${(mem.rss / 1024 / 1024).toFixed(0)} MB · heapUsed ≈ ${(mem.heapUsed / 1024 / 1024).toFixed(0)} MB`,
  );
  console.log(
    "Login: bench0@taskmaster.app / password123 (OWNER de los tres workspaces)",
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
