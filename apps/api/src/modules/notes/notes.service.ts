import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import {
  Action,
  EntityType,
  type ChecklistItem,
  type CreateNoteInput,
  type Note,
  type NoteFilters,
  type UpdateNoteInput,
} from "@taskmaster/contracts";
import { PrismaService } from "../../prisma/prisma.service";
import { sanitizeRichText } from "../../common/sanitize/html";
import { WorkspaceAccessService } from "../workspaces/workspace-access.service";
import { ActivityService } from "../activity/activity.service";

const NOTE_INCLUDE = {
  tags: true,
  items: { orderBy: { order: "asc" as const } },
  collaborators: {
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  },
} satisfies Prisma.NoteInclude;

type NoteWithRelations = Prisma.NoteGetPayload<{
  include: typeof NOTE_INCLUDE;
}>;

@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
    private readonly activity: ActivityService,
  ) {}

  async list(
    workspaceId: string,
    userId: string,
    filters: NoteFilters,
  ): Promise<{
    items: Note[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    await this.access.assertMembership(workspaceId, userId);

    const where: Prisma.NoteWhereInput = { workspaceId };
    if (filters.type) where.type = filters.type;
    if (filters.pinned !== undefined) where.pinned = filters.pinned;
    // Las tags de notas son filas `NoteTag` por nota, así que se filtran por
    // nombre (lo compartido entre notas), no por id.
    if (filters.tag) {
      where.tags = {
        some: { name: { equals: filters.tag, mode: "insensitive" } },
      };
    }
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: "insensitive" } },
        { content: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.note.findMany({
        where,
        include: NOTE_INCLUDE,
        orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      this.prisma.note.count({ where }),
    ]);

    return {
      items: items.map((n) => this.toNoteDto(n)),
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      totalPages: Math.ceil(total / filters.pageSize),
    };
  }

  async get(workspaceId: string, id: string, userId: string): Promise<Note> {
    await this.access.assertMembership(workspaceId, userId);
    const note = await this.prisma.note.findFirst({
      where: { id, workspaceId },
      include: NOTE_INCLUDE,
    });
    if (!note) throw new NotFoundException("Nota no encontrada");
    return this.toNoteDto(note);
  }

  async create(
    workspaceId: string,
    userId: string,
    dto: CreateNoteInput,
  ): Promise<Note> {
    await this.access.assertWriteRole(workspaceId, userId);
    await this.validateCollaborators(workspaceId, dto.collaborators);

    const note = await this.prisma.note.create({
      data: {
        workspaceId,
        authorId: userId,
        type: dto.type,
        title: dto.title ?? null,
        content: sanitizeRichText(dto.content ?? null, "notes.content"),
        color: dto.color ?? null,
        pinned: dto.pinned,
        tags: {
          create: (dto.tags ?? []).map((name) => ({ name })),
        },
        items: {
          create: (dto.items ?? []).map((item) => ({
            text: item.text,
            done: item.done,
            order: item.order,
          })),
        },
        collaborators: {
          create: (dto.collaborators ?? []).map((cId) => ({
            userId: cId,
          })),
        },
      },
      include: NOTE_INCLUDE,
    });

    await this.activity.log(
      workspaceId,
      userId,
      EntityType.NOTE,
      note.id,
      Action.CREATED,
    );

    return this.toNoteDto(note);
  }

  async update(
    workspaceId: string,
    id: string,
    userId: string,
    dto: UpdateNoteInput,
  ): Promise<Note> {
    await this.access.assertWriteRole(workspaceId, userId);

    const existing = await this.prisma.note.findFirst({
      where: { id, workspaceId },
    });
    if (!existing) throw new NotFoundException("Nota no encontrada");

    await this.validateCollaborators(workspaceId, dto.collaborators);

    const note = await this.prisma.$transaction(async (tx) => {
      if (dto.tags !== undefined) {
        const existingTags = await tx.noteTag.findMany({
          where: { noteId: id },
          select: { name: true },
        });
        const existingNames = new Set(existingTags.map((t) => t.name));
        const incomingNames = new Set(dto.tags);
        const toRemove = [...existingNames].filter(
          (name) => !incomingNames.has(name),
        );
        const toAdd = dto.tags.filter((name) => !existingNames.has(name));
        if (toRemove.length > 0) {
          await tx.noteTag.deleteMany({
            where: { noteId: id, name: { in: toRemove } },
          });
        }
        if (toAdd.length > 0) {
          await tx.noteTag.createMany({
            data: toAdd.map((name) => ({ noteId: id, name })),
            skipDuplicates: true,
          });
        }
      }

      if (dto.items !== undefined) {
        const existingItems = await tx.checklistItem.findMany({
          where: { noteId: id },
          select: { id: true },
        });
        const existingIds = new Set(existingItems.map((i) => i.id));
        const incomingIds = new Set(
          dto.items
            .map((item) => item.id)
            .filter((itemId): itemId is string => Boolean(itemId)),
        );
        const toRemove = [...existingIds].filter(
          (itemId) => !incomingIds.has(itemId),
        );
        if (toRemove.length > 0) {
          await tx.checklistItem.deleteMany({
            where: { id: { in: toRemove } },
          });
        }
        for (const [index, item] of dto.items.entries()) {
          const order = item.order ?? index;
          if (item.id && existingIds.has(item.id)) {
            await tx.checklistItem.update({
              where: { id: item.id },
              data: { text: item.text, done: item.done, order },
            });
          } else {
            await tx.checklistItem.create({
              data: { noteId: id, text: item.text, done: item.done, order },
            });
          }
        }
      }

      if (dto.collaborators !== undefined) {
        const existingCollaborators = await tx.noteCollaborator.findMany({
          where: { noteId: id },
          select: { userId: true },
        });
        const existingIds = new Set(existingCollaborators.map((c) => c.userId));
        const incomingIds = new Set(dto.collaborators);
        const toRemove = [...existingIds].filter(
          (cId) => !incomingIds.has(cId),
        );
        const toAdd = dto.collaborators.filter((cId) => !existingIds.has(cId));
        if (toRemove.length > 0) {
          await tx.noteCollaborator.deleteMany({
            where: { noteId: id, userId: { in: toRemove } },
          });
        }
        if (toAdd.length > 0) {
          await tx.noteCollaborator.createMany({
            data: toAdd.map((userId) => ({ noteId: id, userId })),
            skipDuplicates: true,
          });
        }
      }

      return tx.note.update({
        where: { id },
        data: {
          title: dto.title,
          content: sanitizeRichText(dto.content, "notes.content"),
          color: dto.color,
          pinned: dto.pinned,
          type: dto.type,
        },
        include: NOTE_INCLUDE,
      });
    });

    await this.activity.log(
      workspaceId,
      userId,
      EntityType.NOTE,
      id,
      Action.UPDATED,
    );

    return this.toNoteDto(note);
  }

  async togglePin(
    workspaceId: string,
    id: string,
    userId: string,
    pinned: boolean,
  ): Promise<Note> {
    await this.access.assertWriteRole(workspaceId, userId);
    const note = await this.prisma.note.findFirst({
      where: { id, workspaceId },
    });
    if (!note) throw new NotFoundException("Nota no encontrada");

    const updated = await this.prisma.note.update({
      where: { id },
      data: { pinned },
      include: NOTE_INCLUDE,
    });
    return this.toNoteDto(updated);
  }

  async addChecklistItem(
    workspaceId: string,
    id: string,
    userId: string,
    text: string,
  ): Promise<ChecklistItem> {
    await this.access.assertWriteRole(workspaceId, userId);
    const note = await this.prisma.note.findFirst({
      where: { id, workspaceId, type: "CHECKLIST" },
    });
    if (!note)
      throw new NotFoundException("Nota de tipo checklist no encontrada");

    const max = await this.prisma.checklistItem.aggregate({
      where: { noteId: id },
      _max: { order: true },
    });

    return this.prisma.checklistItem.create({
      data: { noteId: id, text, order: (max._max.order ?? -1) + 1 },
    });
  }

  async toggleChecklistItem(
    workspaceId: string,
    noteId: string,
    itemId: string,
    userId: string,
    done: boolean,
  ): Promise<ChecklistItem> {
    await this.access.assertWriteRole(workspaceId, userId);
    const item = await this.prisma.checklistItem.findFirst({
      where: { id: itemId, note: { workspaceId, id: noteId } },
    });
    if (!item)
      throw new NotFoundException("Elemento de checklist no encontrado");

    return this.prisma.checklistItem.update({
      where: { id: itemId },
      data: { done },
    });
  }

  async removeChecklistItem(
    workspaceId: string,
    noteId: string,
    itemId: string,
    userId: string,
  ): Promise<{ id: string }> {
    await this.access.assertWriteRole(workspaceId, userId);
    const item = await this.prisma.checklistItem.findFirst({
      where: { id: itemId, note: { workspaceId, id: noteId } },
    });
    if (!item)
      throw new NotFoundException("Elemento de checklist no encontrado");

    await this.prisma.checklistItem.delete({ where: { id: itemId } });
    return { id: itemId };
  }

  async remove(
    workspaceId: string,
    id: string,
    userId: string,
  ): Promise<{ id: string }> {
    await this.access.assertWriteRole(workspaceId, userId);
    const existing = await this.prisma.note.findFirst({
      where: { id, workspaceId },
    });
    if (!existing) throw new NotFoundException("Nota no encontrada");

    await this.prisma.note.delete({ where: { id } });
    await this.activity.log(
      workspaceId,
      userId,
      EntityType.NOTE,
      id,
      Action.DELETED,
    );
    return { id };
  }

  // â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private async validateCollaborators(
    workspaceId: string,
    collaboratorIds?: string[],
  ): Promise<void> {
    if (!collaboratorIds || collaboratorIds.length === 0) return;
    const count = await this.prisma.workspaceMember.count({
      where: { workspaceId, userId: { in: collaboratorIds } },
    });
    if (count !== collaboratorIds.length) {
      throw new BadRequestException(
        "Algunos colaboradores no son miembros del workspace",
      );
    }
  }

  private toNoteDto(note: NoteWithRelations): Note {
    return {
      id: note.id,
      workspaceId: note.workspaceId,
      authorId: note.authorId,
      type: note.type,
      title: note.title,
      content: note.content,
      color: note.color,
      pinned: note.pinned,
      tags: note.tags.map((t) => ({ id: t.id, name: t.name, color: t.color })),
      items: note.items.map((i) => ({
        id: i.id,
        text: i.text,
        done: i.done,
        order: i.order,
      })),
      collaborators: note.collaborators.map((c) => ({
        id: c.user.id,
        name: c.user.name,
        email: c.user.email,
        avatarUrl: c.user.avatarUrl,
      })),
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    };
  }
}
