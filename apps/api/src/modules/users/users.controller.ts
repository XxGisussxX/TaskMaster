import { Body, Controller, Get, Patch, Put } from "@nestjs/common";
import {
  updateProfileSchema,
  updateUserSettingsSchema,
  type UpdateProfileInput,
  type UpdateUserSettingsInput,
} from "@taskmaster/contracts";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodPipe } from "../../common/pipes/zod.pipe";
import type { AuthUser } from "../auth/types";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return this.usersService.getProfile(user.sub);
  }

  @Patch("me")
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(updateProfileSchema)) dto: UpdateProfileInput,
  ) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  @Get("me/settings")
  getSettings(@CurrentUser() user: AuthUser) {
    return this.usersService.getSettings(user.sub);
  }

  @Put("me/settings")
  updateSettings(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(updateUserSettingsSchema)) dto: UpdateUserSettingsInput,
  ) {
    return this.usersService.updateSettings(user.sub, dto);
  }
}
