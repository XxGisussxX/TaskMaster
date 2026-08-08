import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  addChecklistItemSchema,
  createNoteSchema,
  noteFiltersSchema,
  noteIdParamsSchema,
  taskIdParamsSchema,
  toggleChecklistItemSchema,
  updateNoteSchema,
  type AddChecklistItemInput,
  type CreateNoteInput,
  type NoteFilters,
  type ToggleChecklistItemInput,
  type UpdateNoteInput,
} from "@taskmaster/contracts";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ParseIdPipe } from "../../common/pipes/parse-id.pipe";
import { ZodPipe } from "../../common/pipes/zod.pipe";
import type { AuthUser } from "../auth/types";
import { NotesService } from "./notes.service";

const workspaceIdPipe = new ParseIdPipe(taskIdParamsSchema);
const noteIdPipe = new ParseIdPipe(noteIdParamsSchema);
const itemIdPipe = new ParseIdPipe(noteIdParamsSchema);

@Controller("workspaces/:workspaceId/notes")
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  list(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Query(new ZodPipe(noteFiltersSchema)) filters: NoteFilters,
    @CurrentUser() user: AuthUser,
  ) {
    return this.notesService.list(workspaceId, user.sub, filters);
  }

  @Post()
  create(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(createNoteSchema)) dto: CreateNoteInput,
  ) {
    return this.notesService.create(workspaceId, user.sub, dto);
  }

  @Get(":id")
  get(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Param("id", noteIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.notesService.get(workspaceId, id, user.sub);
  }

  @Patch(":id")
  update(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Param("id", noteIdPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(updateNoteSchema)) dto: UpdateNoteInput,
  ) {
    return this.notesService.update(workspaceId, id, user.sub, dto);
  }

  @Delete(":id")
  remove(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Param("id", noteIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.notesService.remove(workspaceId, id, user.sub);
  }

  @Post(":id/pin")
  pin(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Param("id", noteIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.notesService.togglePin(workspaceId, id, user.sub, true);
  }

  @Post(":id/unpin")
  unpin(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Param("id", noteIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.notesService.togglePin(workspaceId, id, user.sub, false);
  }

  @Post(":id/checklist")
  addChecklistItem(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Param("id", noteIdPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(addChecklistItemSchema)) dto: AddChecklistItemInput,
  ) {
    return this.notesService.addChecklistItem(
      workspaceId,
      id,
      user.sub,
      dto.text,
    );
  }

  @Patch(":id/checklist/:itemId")
  toggleChecklistItem(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Param("id", noteIdPipe) noteId: string,
    @Param("itemId", itemIdPipe) itemId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(toggleChecklistItemSchema)) dto: ToggleChecklistItemInput,
  ) {
    return this.notesService.toggleChecklistItem(
      workspaceId,
      noteId,
      itemId,
      user.sub,
      dto.done,
    );
  }

  @Delete(":id/checklist/:itemId")
  removeChecklistItem(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Param("id", noteIdPipe) noteId: string,
    @Param("itemId", itemIdPipe) itemId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.notesService.removeChecklistItem(
      workspaceId,
      noteId,
      itemId,
      user.sub,
    );
  }
}
