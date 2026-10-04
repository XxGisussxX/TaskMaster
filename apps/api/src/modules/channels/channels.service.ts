import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  Channel,
  CreateChannelInput,
  UpdateChannelInput,
} from "@taskmaster/contracts";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkspaceAccessService } from "../workspaces/workspace-access.service";

@Injectable()
export class ChannelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
  ) {}

  async list(workspaceId: string, userId: string): Promise<Channel[]> {
    await this.access.assertMembership(workspaceId, userId);
    const channels = await this.prisma.channel.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
    });
    return channels.map((c) => ({
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
    dto: CreateChannelInput,
  ): Promise<Channel> {
    await this.access.assertWriteRole(workspaceId, userId);

    const existing = await this.prisma.channel.findUnique({
      where: { workspaceId_name: { workspaceId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException("Ya existe un canal con ese nombre");
    }

    const channel = await this.prisma.channel.create({
      data: {
        workspaceId,
        name: dto.name,
        color: dto.color ?? null,
      },
    });

    return {
      id: channel.id,
      workspaceId: channel.workspaceId,
      name: channel.name,
      color: channel.color,
      createdAt: channel.createdAt.toISOString(),
    };
  }

  async update(
    workspaceId: string,
    id: string,
    userId: string,
    dto: UpdateChannelInput,
  ): Promise<Channel> {
    await this.access.assertWriteRole(workspaceId, userId);

    const existing = await this.prisma.channel.findFirst({
      where: { id, workspaceId },
    });
    if (!existing) throw new NotFoundException("Canal no encontrado");

    if (dto.name && dto.name !== existing.name) {
      const conflict = await this.prisma.channel.findUnique({
        where: { workspaceId_name: { workspaceId, name: dto.name } },
      });
      if (conflict) {
        throw new ConflictException("Ya existe un canal con ese nombre");
      }
    }

    const channel = await this.prisma.channel.update({
      where: { id },
      data: {
        name: dto.name,
        color: dto.color,
      },
    });

    return {
      id: channel.id,
      workspaceId: channel.workspaceId,
      name: channel.name,
      color: channel.color,
      createdAt: channel.createdAt.toISOString(),
    };
  }

  async remove(
    workspaceId: string,
    id: string,
    userId: string,
  ): Promise<{ id: string }> {
    await this.access.assertWriteRole(workspaceId, userId);
    const existing = await this.prisma.channel.findFirst({
      where: { id, workspaceId },
    });
    if (!existing) throw new NotFoundException("Canal no encontrado");

    await this.prisma.channel.delete({ where: { id } });
    return { id };
  }
}
