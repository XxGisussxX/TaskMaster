import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import {
  loginSchema,
  registerSchema,
  refreshTokenSchema,
  type LoginInput,
  type RegisterInput,
  type RefreshTokenInput,
} from "@taskmaster/contracts";
import { Public } from "../../common/decorators/public.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RefreshTokenGuard } from "../../common/guards/refresh-token.guard";
import { ZodPipe } from "../../common/pipes/zod.pipe";
import { AuthService } from "./auth.service";
import type { AuthUser } from "./types";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("register")
  register(@Body(new ZodPipe(registerSchema)) dto: RegisterInput) {
    return this.authService.register(dto);
  }

  @Public()
  @Post("login")
  login(@Body(new ZodPipe(loginSchema)) dto: LoginInput) {
    return this.authService.login(dto);
  }

  @Public()
  @UseGuards(RefreshTokenGuard)
  @Post("refresh")
  refresh(@Body(new ZodPipe(refreshTokenSchema)) dto: RefreshTokenInput) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post("logout")
  logout(@Body(new ZodPipe(refreshTokenSchema)) dto: RefreshTokenInput) {
    return this.authService.logout(dto.refreshToken);
  }

  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.sub);
  }
}
