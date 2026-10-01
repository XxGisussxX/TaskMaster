import { describe, expect, it } from "vitest";
import type { ActivityEntry } from "@taskmaster/contracts";
import { buildAuditCsv } from "./auditExport";

function entry(partial: Partial<ActivityEntry>): ActivityEntry {
  return {
    id: "1",
    workspaceId: "w",
    userId: "u1",
    entityType: "TASK",
    entityId: "t1",
    action: "CREATED",
    changes: null,
    createdAt: "2026-09-18T10:00:00.000Z",
    ...partial,
  };
}

describe("buildAuditCsv", () => {
  it("incluye el encabezado aunque no haya entradas", () => {
    expect(buildAuditCsv([])).toBe(
      ["fecha", "usuario", "email", "accion", "entidad", "id"].join(";"),
    );
  });

  it("serializa una entrada con sus campos", () => {
    const csv = buildAuditCsv([
      entry({
        user: { id: "u1", name: "Ana", email: "ana@x.com", avatarUrl: null },
      }),
    ]);
    expect(csv).toContain(
      "2026-09-18T10:00:00.000Z;Ana;ana@x.com;CREATED;TASK;t1",
    );
  });

  it("escapa punto y coma dentro del nombre", () => {
    const csv = buildAuditCsv([
      entry({
        user: { id: "u1", name: "Ana; María", email: "", avatarUrl: null },
      }),
    ]);
    expect(csv).toContain('"Ana; María"');
  });

  it("usa el userId cuando no hay usuario asociado", () => {
    const csv = buildAuditCsv([entry({ user: undefined })]);
    expect(csv).toContain(";u1;;CREATED;TASK;t1");
  });
});
