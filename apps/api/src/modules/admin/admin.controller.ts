import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  SystemRole,
  adminUserIdParamsSchema,
  updateSystemRoleSchema,
  type UpdateSystemRoleInput,
} from "@taskmaster/contracts";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequireSystemRole } from "../../common/decorators/require-system-role.decorator";
import { ParseIdPipe } from "../../common/pipes/parse-id.pipe";
import { ZodPipe } from "../../common/pipes/zod.pipe";
import { SystemRoleGuard } from "../../common/guards/system-role.guard";
import type { AuthUser } from "../auth/types";
import { AdminService } from "./admin.service";

@Controller("admin")
@UseGuards(SystemRoleGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("users")
  @RequireSystemRole(SystemRole.ADMIN, SystemRole.SUPER_ADMIN)
  listUsers(@Query("page") page = "1", @Query("pageSize") pageSize = "20") {
    return this.adminService.listUsers(
      Math.max(1, Number(page) || 1),
      Math.min(100, Math.max(1, Number(pageSize) || 20)),
    );
  }

  @Patch("users/:id/role")
  @RequireSystemRole(SystemRole.ADMIN, SystemRole.SUPER_ADMIN)
  updateRole(
    @CurrentUser() user: AuthUser,
    @Param("id", new ParseIdPipe(adminUserIdParamsSchema)) id: string,
    @Body(new ZodPipe(updateSystemRoleSchema)) dto: UpdateSystemRoleInput,
  ) {
    return this.adminService.updateRole(user.sub, id, dto);
  }
}
