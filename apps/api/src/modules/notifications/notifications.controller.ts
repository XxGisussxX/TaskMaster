import { Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import {
  notificationFiltersSchema,
  taskIdParamsSchema,
} from "@taskmaster/contracts";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ParseIdPipe } from "../../common/pipes/parse-id.pipe";
import { ZodPipe } from "../../common/pipes/zod.pipe";
import type { AuthUser } from "../auth/types";
import { NotificationsService } from "./notifications.service";

const notificationIdPipe = new ParseIdPipe(taskIdParamsSchema);

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodPipe(notificationFiltersSchema)) filters: any,
  ) {
    return this.notificationsService.list(user.sub, filters);
  }

  @Get("unread-count")
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.notificationsService.unreadCount(user.sub);
  }

  @Patch(":id/read")
  markAsRead(
    @CurrentUser() user: AuthUser,
    @Param("id", notificationIdPipe) id: string,
  ) {
    return this.notificationsService.markAsRead(user.sub, id);
  }

  @Post("read-all")
  markAllAsRead(@CurrentUser() user: AuthUser) {
    return this.notificationsService.markAllAsRead(user.sub);
  }
}
