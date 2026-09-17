import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  Category,
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@taskmaster/contracts";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkspaceAccessService } from "../workspaces/workspace-access.service";

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
  ) {}

  async list(workspaceId: string, userId: string): Promise<Category[]> {
    await this.access.assertMembership(workspaceId, userId);
    const categories = await this.prisma.category.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
    });
    return categories.map((c) => ({
      id: c.id,
      workspaceId: c.workspaceId,
      name: c.name,
      color: c.color,
      createdAt: c.createdAt.toISOString(),
    }));
  }

  async create(
    workspaceId: string,
    userId: string,
    dto: CreateCategoryInput,
  ): Promise<Category> {
    await this.access.assertWriteRole(workspaceId, userId);

    const existing = await this.prisma.category.findUnique({
      where: { workspaceId_name: { workspaceId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException("Ya existe una categorÃ­a con ese nombre");
    }

    const category = await this.prisma.category.create({
      data: {
        workspaceId,
        name: dto.name,
        color: dto.color ?? null,
      },
    });

    return {
      id: category.id,
      workspaceId: category.workspaceId,
      name: category.name,
      color: category.color,
      createdAt: category.createdAt.toISOString(),
    };
  }

  async update(
    workspaceId: string,
    id: string,
    userId: string,
    dto: UpdateCategoryInput,
  ): Promise<Category> {
    await this.access.assertWriteRole(workspaceId, userId);

    const existing = await this.prisma.category.findFirst({
      where: { id, workspaceId },
    });
    if (!existing) throw new NotFoundException("CategorÃ­a no encontrada");

    if (dto.name && dto.name !== existing.name) {
      const conflict = await this.prisma.category.findUnique({
        where: { workspaceId_name: { workspaceId, name: dto.name } },
      });
      if (conflict) {
        throw new ConflictException("Ya existe una categorÃ­a con ese nombre");
      }
    }

    const category = await this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name,
        color: dto.color,
      },
    });

    return {
      id: category.id,
      workspaceId: category.workspaceId,
      name: category.name,
      color: category.color,
      createdAt: category.createdAt.toISOString(),
    };
  }

  async remove(
    workspaceId: string,
    id: string,
    userId: string,
  ): Promise<{ id: string }> {
    await this.access.assertWriteRole(workspaceId, userId);
    const existing = await this.prisma.category.findFirst({
      where: { id, workspaceId },
    });
    if (!existing) throw new NotFoundException("CategorÃ­a no encontrada");

    await this.prisma.category.delete({ where: { id } });
    return { id };
  }
}
