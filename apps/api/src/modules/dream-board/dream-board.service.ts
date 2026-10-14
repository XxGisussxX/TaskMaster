import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  CreateDreamPinInput,
  DreamBoardDto,
  DreamPinDto,
  UpdateDreamPinInput,
} from "@taskmaster/contracts";
import { Prisma } from "@prisma/client";
import type { DreamBoard, DreamPin, WorkspaceRole } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkspaceAccessService } from "../workspaces/workspace-access.service";

/** Roles que pueden tocar un pin ajeno: admins del workspace y el owner. */
const ELEVATED_ROLES: WorkspaceRole[] = ["ADMIN", "OWNER"];

/** Pins cronológicos y la tarea vinculada con un select mínimo. */
const BOARD_INCLUDE = {
  pins: {
    orderBy: { createdAt: "asc" as const },
    include: {
      linkedTask: { select: { id: true, title: true, status: true } },
    },
  },
} satisfies Prisma.DreamBoardInclude;

type PinRecord = DreamPin;
type BoardRecord = Prisma.DreamBoardGetPayload<{
  include: typeof BOARD_INCLUDE;
}>;

@Injectable()
export class DreamBoardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
  ) {}

  /** Devuelve el tablero del workspace creándolo si es el primer GET. */
  async getBoard(workspaceId: string, userId: string): Promise<DreamBoardDto> {
    await this.access.assertMembership(workspaceId, userId);

    const existing = await this.prisma.dreamBoard.findUnique({
      where: { workspaceId },
      include: BOARD_INCLUDE,
    });
    if (existing) return this.toBoardDto(existing);

    // Primera consulta: lo crea (tolerando la carrera ver `ensureBoard`).
    await this.ensureBoard(workspaceId);
    const board = await this.prisma.dreamBoard.findUniqueOrThrow({
      where: { workspaceId },
      include: BOARD_INCLUDE,
    });

    return this.toBoardDto(board);
  }

  async createPin(
    workspaceId: string,
    userId: string,
    dto: CreateDreamPinInput,
  ): Promise<DreamPinDto> {
    await this.access.assertWriteRole(workspaceId, userId);
    const board = await this.ensureBoard(workspaceId);
    await this.assertLinkedTaskInWorkspace(workspaceId, dto.linkedTaskId);

    const pin = await this.prisma.dreamPin.create({
      data: {
        workspaceId,
        boardId: board.id,
        title: dto.title,
        description: dto.description,
        type: dto.type,
        color: dto.color,
        x: dto.positionX,
        y: dto.positionY,
        imageUrl: dto.imageUrl,
        sticker: dto.sticker,
        linkedTaskId: dto.linkedTaskId,
        createdById: userId,
      },
      include: {
        linkedTask: { select: { id: true, title: true, status: true } },
      },
    });

    await this.touchBoard(workspaceId);

    return this.toPinDto(pin);
  }

  async updatePin(
    workspaceId: string,
    pinId: string,
    userId: string,
    dto: UpdateDreamPinInput,
  ): Promise<DreamPinDto> {
    const member = await this.access.assertWriteRole(workspaceId, userId);
    const existing = await this.requirePin(workspaceId, pinId);
    this.assertCanMutate(existing, member.userId, member.role);
    await this.assertLinkedTaskInWorkspace(workspaceId, dto.linkedTaskId);

    // Un campo ausente (`undefined`) no se toca; `null` (o "") borra a
    // propósito. Armar el `data` sólo con las claves presentes evita que un
    // drag & drop con `{ positionX, positionY }` anule imagen, sticker o tarea.
    // Se usa la variante "unchecked" porque la FKs (linkedTaskId) son escalares.
    const data: Prisma.DreamPinUncheckedUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.color !== undefined) data.color = dto.color;
    if (dto.positionX !== undefined) data.x = dto.positionX;
    if (dto.positionY !== undefined) data.y = dto.positionY;
    if (dto.imageUrl !== undefined) {
      data.imageUrl = dto.imageUrl === "" ? null : dto.imageUrl;
    }
    if (dto.sticker !== undefined) {
      data.sticker = dto.sticker === "" ? null : dto.sticker;
    }
    if (dto.linkedTaskId !== undefined) {
      data.linkedTaskId = dto.linkedTaskId === "" ? null : dto.linkedTaskId;
    }

    const pin = await this.prisma.dreamPin.update({
      where: { id: pinId },
      data,
      include: {
        linkedTask: { select: { id: true, title: true, status: true } },
      },
    });

    await this.touchBoard(workspaceId);

    return this.toPinDto(pin);
  }

  async removePin(
    workspaceId: string,
    pinId: string,
    userId: string,
  ): Promise<{ id: string }> {
    const member = await this.access.assertWriteRole(workspaceId, userId);
    const existing = await this.requirePin(workspaceId, pinId);
    this.assertCanMutate(existing, member.userId, member.role);

    await this.prisma.dreamPin.delete({ where: { id: pinId } });
    await this.touchBoard(workspaceId);
    return { id: pinId };
  }

  /**
   * Marca el tablero como modificado. `DreamPin` es una tabla aparte, así que el
   * `@updatedAt` del `DreamBoard` no se mueve al tocar un pin; lo actualizamos
   * explícitamente para que `DreamBoardDto.updatedAt` refleje el último cambio.
   */
  private async touchBoard(workspaceId: string): Promise<void> {
    await this.prisma.dreamBoard.update({
      where: { workspaceId },
      data: { updatedAt: new Date() },
    });
  }

  /** Devuelve el pin validando que pertenezca al workspace indicado. */
  private async requirePin(
    workspaceId: string,
    pinId: string,
  ): Promise<PinRecord> {
    const pin = await this.prisma.dreamPin.findFirst({
      where: { id: pinId, workspaceId },
    });
    if (!pin) throw new NotFoundException("Pin no encontrado");
    return pin;
  }

  /** Solo el autor del pin o un admin/owner del workspace pueden mutarlo. */
  private assertCanMutate(
    pin: PinRecord,
    userId: string,
    role: WorkspaceRole,
  ): void {
    const isAuthor = pin.createdById === userId;
    if (!isAuthor && !ELEVATED_ROLES.includes(role)) {
      throw new ForbiddenException("Solo podés modificar tus propios pins");
    }
  }

  /**
   * El pin puede enlazar a una tarea de su propio workspace únicamente. Sin esta
   * validación, un miembro del workspace A podría enlazar (y leer el título y el
   * estado de) una tarea del workspace B (IDOR).
   */
  private async assertLinkedTaskInWorkspace(
    workspaceId: string,
    taskId?: string | null,
  ): Promise<void> {
    if (!taskId) return;
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, workspaceId },
      select: { id: true },
    });
    if (!task) throw new NotFoundException("Tarea no encontrada");
  }

  /**
   * Devuelve (creándolo si falta) el tablero del workspace.
   *
   * `find-then-create` es una TOCTOU clásica: dos `GET /dream-board` (o un GET
   * y la primera creación de un pin) concurrentes pasan el `findUnique` y las
   * dos intentan insertar, y el perdedor muere con P2002 por
   * `@@unique(workspaceId)`. En lugar de propagar ese error se reintenta la
   * lectura: el estado del tablero es idempotente, no un fallo.
   */
  private async ensureBoard(workspaceId: string): Promise<DreamBoard> {
    const existing = await this.prisma.dreamBoard.findUnique({
      where: { workspaceId },
    });
    if (existing) return existing;

    try {
      return await this.prisma.dreamBoard.create({ data: { workspaceId } });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return await this.prisma.dreamBoard.findUniqueOrThrow({
          where: { workspaceId },
        });
      }
      throw error;
    }
  }

  private toPinDto(
    pin: PinRecord & {
      linkedTask?: { id: string; title: string; status: string } | null;
    },
  ): DreamPinDto {
    return {
      id: pin.id,
      boardId: pin.boardId,
      title: pin.title,
      description: pin.description,
      type: pin.type,
      color: pin.color,
      x: pin.x,
      y: pin.y,
      imageUrl: pin.imageUrl,
      sticker: pin.sticker,
      linkedTaskId: pin.linkedTaskId,
      linkedTask: pin.linkedTask ?? null,
      createdAt: pin.createdAt.toISOString(),
      updatedAt: pin.updatedAt.toISOString(),
    };
  }

  private toBoardDto(board: BoardRecord): DreamBoardDto {
    return {
      id: board.id,
      workspaceId: board.workspaceId,
      title: board.title,
      createdAt: board.createdAt.toISOString(),
      updatedAt: board.updatedAt.toISOString(),
      pins: (board.pins ?? []).map((pin) => this.toPinDto(pin as any)),
    };
  }
}

/** P2002 = violación de unique (por ej. `@@unique(workspaceId)` del board). */
function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
