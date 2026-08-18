import { describe, expect, it } from "vitest";
import { Priority, TaskStatus } from "@taskmaster/contracts";
import {
  buildTaskTree,
  filterTasks,
  getTaskStats,
  isDueToday,
  isOverdue,
  sortTasks,
} from "../src/tasks";
import { makeTask } from "./helpers";

describe("isOverdue", () => {
  const now = new Date("2026-08-07T12:00:00Z");

  it("is true for past due dates on active tasks", () => {
    expect(isOverdue(makeTask({ dueDate: "2026-08-05" }), now)).toBe(true);
  });

  it("is false for future due dates", () => {
    expect(isOverdue(makeTask({ dueDate: "2026-08-10" }), now)).toBe(false);
  });

  it("is false for tasks without due date", () => {
    expect(isOverdue(makeTask({}), now)).toBe(false);
  });

  it("is false for completed tasks even if overdue", () => {
    expect(
      isOverdue(
        makeTask({ dueDate: "2026-08-01", status: TaskStatus.DONE }),
        now,
      ),
    ).toBe(false);
  });

  it("is false for tasks due today", () => {
    expect(isDueToday(makeTask({ dueDate: "2026-08-07" }), now)).toBe(true);
  });
});

describe("getTaskStats", () => {
  const now = new Date("2026-08-07T12:00:00Z");
  const tasks = [
    makeTask({ dueDate: "2026-08-05", status: TaskStatus.IN_PROGRESS }),
    makeTask({ dueDate: "2026-08-07", status: TaskStatus.TODO }),
    makeTask({ status: TaskStatus.DONE, completedAt: "2026-08-07T10:00:00Z" }),
    makeTask({ status: TaskStatus.TODO }),
  ];

  it("computes totals, overdue, due today and completion rate", () => {
    const stats = getTaskStats(tasks, now);
    expect(stats.total).toBe(4);
    expect(stats.active).toBe(3);
    expect(stats.completed).toBe(1);
    expect(stats.overdue).toBe(1);
    expect(stats.dueToday).toBe(1);
    expect(stats.completionRate).toBe(25);
  });

  it("excludes ARCHIVED from active count", () => {
    const archived = [
      makeTask({ status: TaskStatus.TODO }),
      makeTask({
        status: TaskStatus.DONE,
        completedAt: "2026-08-07T10:00:00Z",
      }),
      makeTask({ status: TaskStatus.ARCHIVED }),
    ];
    const stats = getTaskStats(archived, now);
    expect(stats.active).toBe(1);
    expect(stats.completed).toBe(1);
    expect(stats.total).toBe(3);
  });
});

describe("filterTasks", () => {
  const tasks = [
    makeTask({
      title: "Deploy API",
      priority: Priority.HIGH,
      status: TaskStatus.IN_PROGRESS,
      tags: [{ id: "tag1", name: "backend", color: null }],
      assignees: [{ id: "u1", name: "A", email: "a@x.io", avatarUrl: null }],
    }),
    makeTask({
      title: "Write docs",
      priority: Priority.LOW,
      status: TaskStatus.TODO,
    }),
    makeTask({
      title: "Fix bug",
      priority: Priority.URGENT,
      status: TaskStatus.TODO,
    }),
  ];

  it("filters by status", () => {
    expect(filterTasks(tasks, { status: TaskStatus.TODO }).length).toBe(2);
  });

  it("filters by priority", () => {
    expect(filterTasks(tasks, { priority: Priority.HIGH }).length).toBe(1);
  });

  it("filters by tag", () => {
    expect(filterTasks(tasks, { tagId: "tag1" }).length).toBe(1);
  });

  it("filters by assignee (onlyMine)", () => {
    expect(filterTasks(tasks, { onlyMine: true }, "u1").length).toBe(1);
    expect(filterTasks(tasks, { onlyMine: true }, "u2").length).toBe(0);
  });

  it("returns empty when onlyMine is true but no currentUserId", () => {
    expect(filterTasks(tasks, { onlyMine: true })).toHaveLength(0);
  });

  it("searches title and description", () => {
    expect(filterTasks(tasks, { search: "deploy" }).length).toBe(1);
    expect(filterTasks(tasks, { search: "razon" }, undefined).length).toBe(0);
  });

  it("combines status + priority", () => {
    expect(
      filterTasks(tasks, { status: TaskStatus.TODO, priority: Priority.LOW })
        .length,
    ).toBe(1);
  });
});

describe("sortTasks", () => {
  it("orders by priority rank (urgent first)", () => {
    const sorted = sortTasks(
      [
        makeTask({ priority: Priority.MEDIUM }),
        makeTask({ priority: Priority.URGENT }),
        makeTask({ priority: Priority.LOW }),
      ],
      "priority",
    );
    expect(sorted.map((t) => t.priority)).toEqual([
      Priority.URGENT,
      Priority.MEDIUM,
      Priority.LOW,
    ]);
  });

  it("puts tasks without due date last", () => {
    const sorted = sortTasks(
      [
        makeTask({}),
        makeTask({ dueDate: "2026-08-01" }),
        makeTask({ dueDate: "2026-08-10" }),
      ],
      "dueDate",
    );
    expect(sorted[0]?.dueDate).toBe("2026-08-01");
    expect(sorted[1]?.dueDate).toBe("2026-08-10");
    expect(sorted[2]?.dueDate).toBeNull();
  });
});

describe("buildTaskTree", () => {
  it("nests subtasks under their parent", () => {
    const parent = makeTask({ id: "p1", title: "Parent" });
    const child1 = makeTask({
      id: "c1",
      title: "Child 1",
      parentId: "p1",
      order: 2,
    });
    const child2 = makeTask({
      id: "c2",
      title: "Child 2",
      parentId: "p1",
      order: 1,
    });

    const tree = buildTaskTree([child1, child2, parent]);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.subtasks.map((s) => s.id)).toEqual(["c2", "c1"]);
  });

  it("nests grandchildren (3+ levels deep)", () => {
    const root = makeTask({ id: "r1", title: "Root" });
    const child = makeTask({
      id: "c1",
      title: "Child",
      parentId: "r1",
      order: 0,
    });
    const grandchild = makeTask({
      id: "g1",
      title: "Grandchild",
      parentId: "c1",
      order: 0,
    });

    const tree = buildTaskTree([grandchild, child, root]);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.subtasks).toHaveLength(1);
    expect(tree[0]?.subtasks[0]?.subtasks).toHaveLength(1);
    expect(tree[0]?.subtasks[0]?.subtasks[0]?.id).toBe("g1");
  });

  it("handles orphaned children (parentId points to missing task)", () => {
    const orphan = makeTask({
      id: "o1",
      title: "Orphan",
      parentId: "nonexistent",
    });
    const tree = buildTaskTree([orphan]);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.id).toBe("o1");
    expect(tree[0]?.subtasks).toEqual([]);
  });
});
