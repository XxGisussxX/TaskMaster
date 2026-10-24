import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLocalNote, listLocalNotes, updateLocalNote } from "./localNotes";

describe("localNotes", () => {
  const workspaceId = "local-demo";

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("sanitizes content on create", () => {
    const note = createLocalNote(workspaceId, {
      title: "test",
      content: "<p>hi</p><script>alert(1)</script>",
    });
    expect(note.content).toContain("hi");
    expect(note.content).not.toContain("script");
  });

  it("sanitizes content on update when present", () => {
    const note = createLocalNote(workspaceId, {
      title: "test",
      content: "<p>ok</p>",
    });
    const updated = updateLocalNote(workspaceId, note.id, {
      content: '<p>bad</p><iframe src="evil"></iframe>',
    });
    expect(updated.content).toContain("bad");
    expect(updated.content).not.toContain("iframe");
  });

  it("preserves content when update.content is undefined", () => {
    const note = createLocalNote(workspaceId, {
      title: "test",
      content: "<p>keep</p>",
    });
    const updated = updateLocalNote(workspaceId, note.id, { title: "new" });
    expect(updated.content).toBe(note.content);
  });

  it("preserves null content", () => {
    const note = createLocalNote(workspaceId, {
      title: "test",
      content: null,
    });
    expect(note.content).toBeNull();
  });

  it("lists pinned notes first then by updatedAt desc", () => {
    const olderPinned = createLocalNote(workspaceId, {
      title: "pinned-old",
      pinned: true,
    });
    olderPinned.updatedAt = new Date(Date.now() - 10000).toISOString();
    const newerUnpinned = createLocalNote(workspaceId, { title: "unpin-new" });
    newerUnpinned.updatedAt = new Date(Date.now() - 1000).toISOString();

    const store = JSON.parse(
      localStorage.getItem("taskmaster.local.notes") ?? "{}",
    );
    store[workspaceId] = [newerUnpinned, olderPinned];
    localStorage.setItem("taskmaster.local.notes", JSON.stringify(store));

    const { items } = listLocalNotes(workspaceId);
    expect(items[0]?.title).toBe("pinned-old");
    expect(items[0]?.pinned).toBe(true);
  });
});
