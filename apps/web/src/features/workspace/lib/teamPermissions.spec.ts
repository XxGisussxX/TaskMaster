import { describe, expect, it } from "vitest";
import { WorkspaceRole } from "@taskmaster/contracts";
import {
  canChangeRoleOf,
  canManageMembers,
  canWrite,
  canRemoveMember,
  filterMembers,
  roleOptionsFor,
  ROLE_LABELS,
} from "./teamPermissions";

const OWNER = WorkspaceRole.OWNER;
const ADMIN = WorkspaceRole.ADMIN;
const MEMBER = WorkspaceRole.MEMBER;
const VIEWER = WorkspaceRole.VIEWER;

describe("teamPermissions", () => {
  it("traduce los roles a etiquetas en español", () => {
    expect(ROLE_LABELS[OWNER]).toBe("Propietario");
    expect(ROLE_LABELS[ADMIN]).toBe("Administrador");
    expect(ROLE_LABELS[MEMBER]).toBe("Miembro");
    expect(ROLE_LABELS[VIEWER]).toBe("Observador");
  });

  it("canWrite: solo owner/admin/member escriben", () => {
    expect(canWrite(OWNER)).toBe(true);
    expect(canWrite(ADMIN)).toBe(true);
    expect(canWrite(MEMBER)).toBe(true);
    expect(canWrite(VIEWER)).toBe(false);
    expect(canWrite(null)).toBe(false);
  });

  it("canManageMembers: owner y admin gestionan; el resto no", () => {
    expect(canManageMembers(OWNER)).toBe(true);
    expect(canManageMembers(ADMIN)).toBe(true);
    expect(canManageMembers(MEMBER)).toBe(false);
    expect(canManageMembers(VIEWER)).toBe(false);
    expect(canManageMembers(null)).toBe(false);
  });

  it("canChangeRoleOf: nadie toca al propietario", () => {
    expect(canChangeRoleOf(OWNER, { role: OWNER })).toBe(false);
    expect(canChangeRoleOf(ADMIN, { role: OWNER })).toBe(false);
    expect(canChangeRoleOf(MEMBER, { role: OWNER })).toBe(false);
  });

  it("canChangeRoleOf: solo el propietario modifica a un admin", () => {
    expect(canChangeRoleOf(OWNER, { role: ADMIN })).toBe(true);
    expect(canChangeRoleOf(ADMIN, { role: ADMIN })).toBe(false);
    expect(canChangeRoleOf(MEMBER, { role: ADMIN })).toBe(false);
  });

  it("canChangeRoleOf: owner y admin modifican a member/viewer", () => {
    expect(canChangeRoleOf(OWNER, { role: MEMBER })).toBe(true);
    expect(canChangeRoleOf(ADMIN, { role: MEMBER })).toBe(true);
    expect(canChangeRoleOf(MEMBER, { role: MEMBER })).toBe(false);
    expect(canChangeRoleOf(VIEWER, { role: VIEWER })).toBe(false);
    expect(canChangeRoleOf(null, { role: MEMBER })).toBe(false);
  });

  it("canRemoveMember: no te eliminas a ti mismo", () => {
    const me = { role: MEMBER, userId: "u1" };
    expect(canRemoveMember(ADMIN, me, "u1")).toBe(false);
    expect(canRemoveMember(OWNER, me, "u1")).toBe(false);
  });

  it("canRemoveMember: solo owner elimina un admin", () => {
    const admin = { role: ADMIN, userId: "admin" };
    expect(canRemoveMember(ADMIN, admin, "yo")).toBe(false);
    expect(canRemoveMember(OWNER, admin, "yo")).toBe(true);
  });

  it("canRemoveMember: owner/admin eliminan member/viewer, no al owner", () => {
    const member = { role: MEMBER, userId: "m1" };
    expect(canRemoveMember(OWNER, member, "yo")).toBe(true);
    expect(canRemoveMember(ADMIN, member, "yo")).toBe(true);
    expect(canRemoveMember(MEMBER, member, "yo")).toBe(false);

    const owner = { role: OWNER, userId: "owner" };
    expect(canRemoveMember(OWNER, owner, "yo")).toBe(false);
    expect(canRemoveMember(ADMIN, owner, "yo")).toBe(false);
  });

  it("roleOptionsFor: owner puede asignar los 4 roles", () => {
    expect(roleOptionsFor(OWNER, MEMBER)).toEqual([
      OWNER,
      ADMIN,
      MEMBER,
      VIEWER,
    ]);
  });

  it("roleOptionsFor: admin no asigna owner ni toca admins", () => {
    expect(roleOptionsFor(ADMIN, MEMBER)).toEqual([ADMIN, MEMBER, VIEWER]);
    expect(roleOptionsFor(ADMIN, VIEWER)).toEqual([ADMIN, MEMBER, VIEWER]);
    expect(roleOptionsFor(ADMIN, ADMIN)).toEqual([]);
    expect(roleOptionsFor(ADMIN, OWNER)).toEqual([]);
  });

  it("filterMembers: filtra por texto y rol", () => {
    const members = [
      {
        id: "a",
        workspaceId: "w",
        userId: "u1",
        role: ADMIN,
        user: {
          id: "u1",
          name: "Ana Pérez",
          email: "ana@x.com",
          avatarUrl: null,
        },
      },
      {
        id: "b",
        workspaceId: "w",
        userId: "u2",
        role: MEMBER,
        user: {
          id: "u2",
          name: "Bruno",
          email: "bruno@x.com",
          avatarUrl: null,
        },
      },
      {
        id: "c",
        workspaceId: "w",
        userId: "u3",
        role: VIEWER,
        user: {
          id: "u3",
          name: "Carla",
          email: "carla@x.com",
          avatarUrl: null,
        },
      },
    ];

    expect(filterMembers(members, { search: "ana" })).toHaveLength(1);
    expect(filterMembers(members, { search: "PEREZ" })).toHaveLength(1);
    expect(filterMembers(members, { search: "@x.com" })).toHaveLength(3);
    expect(filterMembers(members, { role: ADMIN })).toHaveLength(1);
    expect(filterMembers(members, { role: "ALL" })).toHaveLength(3);
    expect(
      filterMembers(members, { search: "bruno", role: MEMBER }),
    ).toHaveLength(1);
    expect(
      filterMembers(members, { search: "bruno", role: VIEWER }),
    ).toHaveLength(0);
    expect(filterMembers(members, { search: "zzz" })).toHaveLength(0);
  });
});
