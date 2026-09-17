import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  CreateTagInput,
  Tag,
  UpdateTagInput,
} from "@taskmaster/contracts";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkspaceAccessService } from "../workspaces/workspace-access.service";

@Injectable()
export class TagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
  ) {}

  async list(workspaceId: string, userId: string): Promise<Tag[]> {
    await this.access.assertMembership(workspaceId, userId);
    const tags = await this.prisma.tag.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
    });
    return tags.map((t) => ({
      id: t.id,
      workspaceId: t.workspaceId,
      name: t.name,
      color: t.color,
      createdAt: t.createdAt.toISOString(),
    }));
  }

  async create(
    workspaceId: string,
    userId: string,
    dto: CreateTagInput,
  ): Promise<Tag> {
    await this.access.assertWriteRole(workspaceId, userId);

    const existing = await this.prisma.tag.findUnique({
      where: { workspaceId_name: { workspaceId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException("Ya existe una etiqueta con ese nombre");
    }

    const tag = await this.prisma.tag.create({
      data: {
        workspaceId,
        name: dto.name,
        color: dto.color ?? null,
      },
    });

    return {
      id: tag.id,
      workspaceId: tag.workspaceId,
      name: tag.name,
      color: tag.color,
      createdAt: tag.createdAt.toISOString(),
    };
  }

  async update(
    workspaceId: string,
    id: string,
    userId: string,
    dto: UpdateTagInput,
  ): Promise<Tag> {
    await this.access.assertWriteRole(workspaceId, userId);

    const existing = await this.prisma.tag.findFirst({
      where: { id, workspaceId },
    });
    if (!existing) throw new NotFoundException("Etiqueta no encontrada");

    if (dto.name && dto.name !== existing.name) {
      const conflict = await this.prisma.tag.findUnique({
        where: { workspaceId_name: { workspaceId, name: dto.name } },
      });
      if (conflict) {
        throw new ConflictException("Ya existe una etiqueta con ese nombre");
      }
    }

    const tag = await this.prisma.tag.update({
      where: { id },
      data: {
        name: dto.name,
        color: dto.color,
      },
    });

    return {
      id: tag.id,
      workspaceId: tag.workspaceId,
      name: tag.name,
      color: tag.color,
      createdAt: tag.createdAt.toISOString(),
    };
  }

  async remove(
    workspaceId: string,
    id: string,
    userId: string,
  ): Promise<{ id: string }> {
    await this.access.assertWriteRole(workspaceId, userId);
    const existing = await this.prisma.tag.findFirst({
      where: { id, workspaceId },
    });
    if (!existing) throw new NotFoundException("Etiqueta no encontrada");

    await this.prisma.tag.delete({ where: { id } });
    return { id };
  }
}
