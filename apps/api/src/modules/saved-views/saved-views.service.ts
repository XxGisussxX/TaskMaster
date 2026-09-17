import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  CreateSavedViewInput,
  SavedView,
  UpdateSavedViewInput,
} from "@taskmaster/contracts";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkspaceAccessService } from "../workspaces/workspace-access.service";

@Injectable()
export class SavedViewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
  ) {}

  async list(workspaceId: string, userId: string): Promise<SavedView[]> {
    await this.access.assertMembership(workspaceId, userId);
    const views = await this.prisma.savedView.findMany({
      where: { workspaceId, userId },
      orderBy: { name: "asc" },
    });
    return views.map((v) => this.toDto(v));
  }

  async get(
    workspaceId: string,
    id: string,
    userId: string,
  ): Promise<SavedView> {
    await this.access.assertMembership(workspaceId, userId);
    const view = await this.prisma.savedView.findFirst({
      where: { id, workspaceId, userId },
    });
    if (!view) throw new NotFoundException("Vista no encontrada");
    return this.toDto(view);
  }

  async create(
    workspaceId: string,
    userId: string,
    dto: CreateSavedViewInput,
  ): Promise<SavedView> {
    await this.access.assertWriteRole(workspaceId, userId);

    const existing = await this.prisma.savedView.findUnique({
      where: {
        workspaceId_userId_name: {
          workspaceId,
          userId,
          name: dto.name,
        },
      },
    });
    if (existing) {
      throw new ConflictException("Ya existe una vista con ese nombre");
    }

    const view = await this.prisma.savedView.create({
      data: {
        workspaceId,
        userId,
        name: dto.name,
        filters: (dto.filters ?? {}) as Prisma.InputJsonValue,
        view: dto.view ?? "cards",
      },
    });

    return this.toDto(view);
  }

  async update(
    workspaceId: string,
    id: string,
    userId: string,
    dto: UpdateSavedViewInput,
  ): Promise<SavedView> {
    await this.access.assertWriteRole(workspaceId, userId);

    const existing = await this.prisma.savedView.findFirst({
      where: { id, workspaceId, userId },
    });
    if (!existing) throw new NotFoundException("Vista no encontrada");

    if (dto.name && dto.name !== existing.name) {
      const conflict = await this.prisma.savedView.findUnique({
        where: {
          workspaceId_userId_name: {
            workspaceId,
            userId,
            name: dto.name,
          },
        },
      });
      if (conflict) {
        throw new ConflictException("Ya existe una vista con ese nombre");
      }
    }

    const view = await this.prisma.savedView.update({
      where: { id },
      data: {
        name: dto.name,
        filters: dto.filters as Prisma.InputJsonValue | undefined,
        view: dto.view,
      },
    });

    return this.toDto(view);
  }

  async remove(
    workspaceId: string,
    id: string,
    userId: string,
  ): Promise<{ id: string }> {
    await this.access.assertWriteRole(workspaceId, userId);
    const existing = await this.prisma.savedView.findFirst({
      where: { id, workspaceId, userId },
    });
    if (!existing) throw new NotFoundException("Vista no encontrada");

    await this.prisma.savedView.delete({ where: { id } });
    return { id };
  }

  private toDto(view: {
    id: string;
    workspaceId: string;
    userId: string;
    name: string;
    filters: unknown;
    view: string;
    createdAt: Date;
    updatedAt: Date;
  }): SavedView {
    return {
      id: view.id,
      workspaceId: view.workspaceId,
      userId: view.userId,
      name: view.name,
      filters: (view.filters as Record<string, unknown>) ?? {},
      view: view.view as SavedView["view"],
      createdAt: view.createdAt.toISOString(),
      updatedAt: view.updatedAt.toISOString(),
    };
  }
}
