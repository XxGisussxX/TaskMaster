import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  CreateTaskTemplateInput,
  TaskTemplate,
  UpdateTaskTemplateInput,
} from "@taskmaster/contracts";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkspaceAccessService } from "../workspaces/workspace-access.service";
import { sanitizeRichText } from "../../common/sanitize/html";

@Injectable()
export class TaskTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
  ) {}

  async create(
    workspaceId: string,
    userId: string,
    dto: CreateTaskTemplateInput,
  ): Promise<TaskTemplate> {
    await this.access.assertWriteRole(workspaceId, userId);

    const existing = await this.prisma.taskTemplate.findUnique({
      where: {
        workspaceId_userId_name: {
          workspaceId,
          userId,
          name: dto.name,
        },
      },
    });
    if (existing) {
      throw new ConflictException("Ya existe una plantilla con ese nombre");
    }

    const sanitizedDescription =
      sanitizeRichText(dto.description ?? "", "task-templates.description") ??
      "";
    const data =
      dto.data && typeof dto.data === "object" && !Array.isArray(dto.data)
        ? { ...(dto.data as Record<string, unknown>) }
        : (dto.data as Prisma.InputJsonValue);
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const desc = (data as Record<string, unknown>).description;
      if (typeof desc === "string") {
        (data as Record<string, unknown>).description = sanitizeRichText(
          desc,
          "task-templates.data.description",
        );
      }
    }

    const template = await this.prisma.taskTemplate.create({
      data: {
        workspaceId,
        userId,
        name: dto.name,
        description: sanitizedDescription,
        data: data as Prisma.InputJsonValue,
      },
    });

    return this.toDto(template);
  }

  async list(workspaceId: string, userId: string): Promise<TaskTemplate[]> {
    await this.access.assertMembership(workspaceId, userId);
    const templates = await this.prisma.taskTemplate.findMany({
      where: { workspaceId, userId },
      orderBy: { name: "asc" },
    });
    return templates.map((t) => this.toDto(t));
  }

  async update(
    workspaceId: string,
    userId: string,
    id: string,
    dto: UpdateTaskTemplateInput,
  ): Promise<TaskTemplate> {
    await this.access.assertWriteRole(workspaceId, userId);

    const existing = await this.prisma.taskTemplate.findFirst({
      where: { id, workspaceId, userId },
    });
    if (!existing) throw new NotFoundException("Plantilla no encontrada");

    if (dto.name && dto.name !== existing.name) {
      const conflict = await this.prisma.taskTemplate.findUnique({
        where: {
          workspaceId_userId_name: {
            workspaceId,
            userId,
            name: dto.name,
          },
        },
      });
      if (conflict) {
        throw new ConflictException("Ya existe una plantilla con ese nombre");
      }
    }

    const updateData: Prisma.TaskTemplateUpdateInput = {
      name: dto.name,
    };
    if (dto.description !== undefined) {
      updateData.description =
        sanitizeRichText(dto.description, "task-templates.description") ?? "";
    }
    if (dto.data !== undefined) {
      const data =
        typeof dto.data === "object" && !Array.isArray(dto.data)
          ? { ...(dto.data as Record<string, unknown>) }
          : (dto.data as Prisma.InputJsonValue);
      if (data && typeof data === "object" && !Array.isArray(data)) {
        const desc = (data as Record<string, unknown>).description;
        if (typeof desc === "string") {
          (data as Record<string, unknown>).description = sanitizeRichText(
            desc,
            "task-templates.data.description",
          );
        }
      }
      updateData.data = data as Prisma.InputJsonValue;
    }

    const template = await this.prisma.taskTemplate.update({
      where: { id },
      data: updateData,
    });

    return this.toDto(template);
  }

  async remove(
    workspaceId: string,
    userId: string,
    id: string,
  ): Promise<{ id: string }> {
    await this.access.assertWriteRole(workspaceId, userId);
    const existing = await this.prisma.taskTemplate.findFirst({
      where: { id, workspaceId, userId },
    });
    if (!existing) throw new NotFoundException("Plantilla no encontrada");

    await this.prisma.taskTemplate.delete({ where: { id } });
    return { id };
  }

  async useTemplate(
    workspaceId: string,
    userId: string,
    id: string,
  ): Promise<TaskTemplate> {
    await this.access.assertWriteRole(workspaceId, userId);
    const template = await this.prisma.taskTemplate.findFirst({
      where: { id, workspaceId, userId },
    });
    if (!template) throw new NotFoundException("Plantilla no encontrada");
    return this.toDto(template);
  }

  private toDto(template: {
    id: string;
    workspaceId: string;
    userId: string;
    name: string;
    description: string;
    data: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): TaskTemplate {
    return {
      id: template.id,
      workspaceId: template.workspaceId,
      userId: template.userId,
      name: template.name,
      description: template.description,
      data: (template.data as Record<string, unknown>) ?? {},
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    };
  }
}
