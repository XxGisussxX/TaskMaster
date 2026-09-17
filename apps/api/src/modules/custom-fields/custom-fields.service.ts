import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  CreateCustomFieldDefinitionInput,
  CustomFieldDefinition,
  CustomFieldValue,
  SetCustomFieldValueInput,
  UpdateCustomFieldDefinitionInput,
} from "@taskmaster/contracts";
import { parseCustomFieldValue } from "@taskmaster/contracts";
import type { CustomFieldType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkspaceAccessService } from "../workspaces/workspace-access.service";

const SUPPORTED_ENTITY_TYPES = ["task", "note"] as const;
type SupportedEntityType = (typeof SUPPORTED_ENTITY_TYPES)[number];

function assertEntityType(
  entityType: string,
): asserts entityType is SupportedEntityType {
  if (!SUPPORTED_ENTITY_TYPES.includes(entityType as SupportedEntityType)) {
    throw new BadRequestException(
      `entityType debe ser task o note (recibido: ${entityType})`,
    );
  }
}

function toDefinition(d: {
  id: string;
  workspaceId: string;
  name: string;
  type: CustomFieldType;
  options: Prisma.JsonValue | null;
  order: number;
  required: boolean;
  createdAt: Date;
}): CustomFieldDefinition {
  return {
    id: d.id,
    workspaceId: d.workspaceId,
    name: d.name,
    type: d.type,
    options: (d.options as string[] | null) ?? null,
    order: d.order,
    required: d.required,
    createdAt: d.createdAt.toISOString(),
  };
}

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
    await this.access.assertWriteRole(workspaceId, userId);

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

    return toDefinition(def);
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

    return defs.map(toDefinition);
  }

  async updateDefinition(
    workspaceId: string,
    userId: string,
    id: string,
    dto: UpdateCustomFieldDefinitionInput,
  ): Promise<CustomFieldDefinition> {
    await this.access.assertWriteRole(workspaceId, userId);

    const existing = await this.prisma.customFieldDefinition.findFirst({
      where: { id, workspaceId },
    });
    if (!existing)
      throw new NotFoundException(
        "DefiniciÃ³n de campo personalizado no encontrada",
      );

    const updated = await this.prisma.customFieldDefinition.update({
      where: { id },
      data: {
        name: dto.name,
        type: dto.type,
        options: dto.options as Prisma.InputJsonValue | undefined,
        order: dto.order,
        required: dto.required,
      },
    });

    return toDefinition(updated);
  }

  async reorderDefinitions(
    workspaceId: string,
    userId: string,
    orderedIds: string[],
  ): Promise<CustomFieldDefinition[]> {
    await this.access.assertWriteRole(workspaceId, userId);

    const existing = await this.prisma.customFieldDefinition.findMany({
      where: { workspaceId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((d) => d.id));
    const missing = orderedIds.filter((id) => !existingIds.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(
        "Se intentaron reordenar definiciones inexistentes",
      );
    }

    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.customFieldDefinition.updateMany({
          where: { id, workspaceId },
          data: { order: index + 1 },
        }),
      ),
    );

    return this.listDefinitions(workspaceId, userId);
  }

  async removeDefinition(
    workspaceId: string,
    userId: string,
    id: string,
  ): Promise<{ id: string }> {
    await this.access.assertWriteRole(workspaceId, userId);

    const existing = await this.prisma.customFieldDefinition.findFirst({
      where: { id, workspaceId },
    });
    if (!existing)
      throw new NotFoundException(
        "DefiniciÃ³n de campo personalizado no encontrada",
      );

    await this.prisma.customFieldDefinition.delete({ where: { id } });
    return { id };
  }

  async setValue(
    workspaceId: string,
    userId: string,
    input: SetCustomFieldValueInput,
  ): Promise<CustomFieldValue> {
    await this.access.assertWriteRole(workspaceId, userId);
    assertEntityType(input.entityType);

    const def = await this.prisma.customFieldDefinition.findFirst({
      where: { id: input.definitionId, workspaceId },
    });
    if (!def)
      throw new NotFoundException(
        "DefiniciÃ³n de campo personalizado no encontrada",
      );

    await this.assertEntityBelongsToWorkspace(
      input.entityType,
      input.entityId,
      workspaceId,
    );

    const parsed = parseCustomFieldValue(input, {
      def: {
        type: def.type,
        required: def.required,
        options: (def.options as string[] | null) ?? [],
      },
      label: def.name,
      checkRequired: true,
    });
    if (!parsed.success) {
      throw new BadRequestException(parsed.message);
    }

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
    assertEntityType(entityType);

    const values = await this.prisma.customFieldValue.findMany({
      where: { entityId, entityType, definition: { workspaceId } },
      include: { definition: true },
    });

    return values
      .filter((v) => v.definition.workspaceId === workspaceId)
      .map((v) => ({
        id: v.id,
        definitionId: v.definitionId,
        entityId: v.entityId,
        entityType: v.entityType,
        value: v.value,
        definition: toDefinition(v.definition),
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
    assertEntityType(entityType);

    const values = await this.prisma.customFieldValue.findMany({
      where: {
        entityType,
        entityId: { in: entityIds },
        definition: { workspaceId },
      },
      include: { definition: true },
    });

    const mapped: Record<string, CustomFieldValue[]> = {};
    for (const v of values) {
      if (v.definition.workspaceId !== workspaceId) continue;
      const item: CustomFieldValue = {
        id: v.id,
        definitionId: v.definitionId,
        entityId: v.entityId,
        entityType: v.entityType,
        value: v.value,
        definition: toDefinition(v.definition),
        createdAt: v.createdAt.toISOString(),
      };
      if (!mapped[v.entityId]) mapped[v.entityId] = [];
      mapped[v.entityId]!.push(item);
    }

    return mapped;
  }

  private async assertEntityBelongsToWorkspace(
    entityType: SupportedEntityType,
    entityId: string,
    workspaceId: string,
  ): Promise<void> {
    const entity =
      entityType === "task"
        ? await this.prisma.task.findFirst({
            where: { id: entityId, workspaceId },
            select: { id: true },
          })
        : await this.prisma.note.findFirst({
            where: { id: entityId, workspaceId },
            select: { id: true },
          });

    if (!entity) {
      throw new NotFoundException(
        "La entidad referenciada no pertenece a este espacio de trabajo",
      );
    }
  }
}
