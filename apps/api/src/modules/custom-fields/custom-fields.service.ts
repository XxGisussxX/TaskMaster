import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  CreateCustomFieldDefinitionInput,
  CustomFieldDefinition,
  CustomFieldValue,
  SetCustomFieldValueInput,
  UpdateCustomFieldDefinitionInput,
} from "@taskmaster/contracts";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkspaceAccessService } from "../workspaces/workspace-access.service";

@Injectable()
export class CustomFieldsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
  ) {}

  async createDefinition(
    workspaceId: string,
    userId: string,
    dto: CreateCustomFieldDefinitionInput,
  ): Promise<CustomFieldDefinition> {
    await this.access.assertMembership(workspaceId, userId);

    const def = await this.prisma.customFieldDefinition.create({
      data: {
        workspaceId,
        name: dto.name,
        type: dto.type,
        options: (dto.options as Prisma.InputJsonValue) ?? null,
        order: dto.order ?? 0,
        required: dto.required ?? false,
      },
    });

    return {
      id: def.id,
      workspaceId: def.workspaceId,
      name: def.name,
      type: def.type,
      options: (def.options as string[] | null) ?? null,
      order: def.order,
      required: def.required,
      createdAt: def.createdAt.toISOString(),
    };
  }

  async listDefinitions(
    workspaceId: string,
    userId: string,
  ): Promise<CustomFieldDefinition[]> {
    await this.access.assertMembership(workspaceId, userId);

    const defs = await this.prisma.customFieldDefinition.findMany({
      where: { workspaceId },
      orderBy: { order: "asc" },
    });

    return defs.map((d) => ({
      id: d.id,
      workspaceId: d.workspaceId,
      name: d.name,
      type: d.type,
      options: (d.options as string[] | null) ?? null,
      order: d.order,
      required: d.required,
      createdAt: d.createdAt.toISOString(),
    }));
  }

  async updateDefinition(
    workspaceId: string,
    userId: string,
    id: string,
    dto: UpdateCustomFieldDefinitionInput,
  ): Promise<CustomFieldDefinition> {
    await this.access.assertMembership(workspaceId, userId);

    const existing = await this.prisma.customFieldDefinition.findFirst({
      where: { id, workspaceId },
    });
    if (!existing)
      throw new NotFoundException(
        "Definición de campo personalizado no encontrada",
      );

    const def = await this.prisma.customFieldDefinition.update({
      where: { id },
      data: {
        name: dto.name,
        type: dto.type,
        options: dto.options as Prisma.InputJsonValue | undefined,
        order: dto.order,
        required: dto.required,
      },
    });

    return {
      id: def.id,
      workspaceId: def.workspaceId,
      name: def.name,
      type: def.type,
      options: (def.options as string[] | null) ?? null,
      order: def.order,
      required: def.required,
      createdAt: def.createdAt.toISOString(),
    };
  }

  async removeDefinition(
    workspaceId: string,
    userId: string,
    id: string,
  ): Promise<{ id: string }> {
    await this.access.assertMembership(workspaceId, userId);

    const existing = await this.prisma.customFieldDefinition.findFirst({
      where: { id, workspaceId },
    });
    if (!existing)
      throw new NotFoundException(
        "Definición de campo personalizado no encontrada",
      );

    await this.prisma.customFieldDefinition.delete({ where: { id } });
    return { id };
  }

  async setValue(
    workspaceId: string,
    userId: string,
    input: SetCustomFieldValueInput,
  ): Promise<CustomFieldValue> {
    await this.access.assertMembership(workspaceId, userId);

    const def = await this.prisma.customFieldDefinition.findFirst({
      where: { id: input.definitionId, workspaceId },
    });
    if (!def)
      throw new NotFoundException(
        "Definición de campo personalizado no encontrada",
      );

    const value = await this.prisma.customFieldValue.upsert({
      where: {
        definitionId_entityId: {
          definitionId: input.definitionId,
          entityId: input.entityId,
        },
      },
      create: {
        definitionId: input.definitionId,
        entityId: input.entityId,
        entityType: input.entityType,
        value: input.value as Prisma.InputJsonValue,
      },
      update: { value: input.value as Prisma.InputJsonValue },
    });

    return {
      id: value.id,
      definitionId: value.definitionId,
      entityId: value.entityId,
      entityType: value.entityType,
      value: value.value,
      createdAt: value.createdAt.toISOString(),
    };
  }

  async getValues(
    workspaceId: string,
    userId: string,
    entityType: string,
    entityId: string,
  ): Promise<CustomFieldValue[]> {
    await this.access.assertMembership(workspaceId, userId);

    const values = await this.prisma.customFieldValue.findMany({
      where: { entityId, entityType },
      include: { definition: true },
    });

    return values.map((v) => ({
      id: v.id,
      definitionId: v.definitionId,
      entityId: v.entityId,
      entityType: v.entityType,
      value: v.value,
      definition: {
        id: v.definition.id,
        workspaceId: v.definition.workspaceId,
        name: v.definition.name,
        type: v.definition.type,
        options: (v.definition.options as string[] | null) ?? null,
        order: v.definition.order,
        required: v.definition.required,
        createdAt: v.definition.createdAt.toISOString(),
      },
      createdAt: v.createdAt.toISOString(),
    }));
  }

  async getValuesForMany(
    workspaceId: string,
    userId: string,
    entityType: string,
    entityIds: string[],
  ): Promise<Record<string, CustomFieldValue[]>> {
    await this.access.assertMembership(workspaceId, userId);

    const values = await this.prisma.customFieldValue.findMany({
      where: { entityType, entityId: { in: entityIds } },
      include: { definition: true },
    });

    const mapped: Record<string, CustomFieldValue[]> = {};
    for (const v of values) {
      const item: CustomFieldValue = {
        id: v.id,
        definitionId: v.definitionId,
        entityId: v.entityId,
        entityType: v.entityType,
        value: v.value,
        definition: {
          id: v.definition.id,
          workspaceId: v.definition.workspaceId,
          name: v.definition.name,
          type: v.definition.type,
          options: (v.definition.options as string[] | null) ?? null,
          order: v.definition.order,
          required: v.definition.required,
          createdAt: v.definition.createdAt.toISOString(),
        },
        createdAt: v.createdAt.toISOString(),
      };
      if (!mapped[v.entityId]) mapped[v.entityId] = [];
      mapped[v.entityId]!.push(item);
    }

    return mapped;
  }
}
