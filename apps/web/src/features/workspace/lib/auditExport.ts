import type { ActivityEntry } from "@taskmaster/contracts";

const HEADER = ["fecha", "usuario", "email", "accion", "entidad", "id"];

function csvCell(value: string): string {
  if (/[";\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** CSV del registro de auditoría a partir del listado real de actividad. */
export function buildAuditCsv(entries: ActivityEntry[]): string {
  const rows = entries.map((entry) => {
    const cells = [
      new Date(entry.createdAt).toISOString(),
      entry.user?.name ?? entry.userId,
      entry.user?.email ?? "",
      entry.action,
      entry.entityType,
      entry.entityId,
    ];
    return cells.map(csvCell).join(";");
  });
  return [HEADER.join(";"), ...rows].join("\n");
}

/** Descarga el CSV (con BOM para Excel). Usa datos reales, nunca simula. */
export function exportAuditCsv(
  entries: ActivityEntry[],
  workspaceName: string,
): void {
  const payload = "\uFEFF" + buildAuditCsv(entries);
  const blob = new Blob([payload], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  const slug =
    workspaceName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "workspace";
  anchor.download = `auditoria-${slug}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
