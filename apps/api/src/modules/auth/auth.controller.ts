import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  refreshTokenSchema,
  type ChangePasswordInput,
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

function requestMetadata(req: Request): { ip: string; device: string } {
  const forwarded = req.headers["x-forwarded-for"];
  const firstForwarded = Array.isArray(forwarded)
    ? forwarded[0]
    : forwarded?.split(",")[0]?.trim();
  const ip = firstForwarded || req.socket?.remoteAddress || "unknown";
  const device = (req.headers["user-agent"] as string | undefined) ?? "unknown";
  return { ip, device };
}

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 3, ttl: 300_000 } })
  @Post("register")
  register(
    @Req() req: Request,
    @Body(new ZodPipe(registerSchema)) dto: RegisterInput,
  ) {
    return this.authService.register(dto, requestMetadata(req));
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("login")
  login(@Req() req: Request, @Body(new ZodPipe(loginSchema)) dto: LoginInput) {
    return this.authService.login(dto, requestMetadata(req));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseGuards(RefreshTokenGuard)
  @Post("refresh")
  refresh(
    @Req() req: Request,
    @Body(new ZodPipe(refreshTokenSchema)) dto: RefreshTokenInput,
  ) {
    return this.authService.refresh(dto.refreshToken, requestMetadata(req));
  }

  @Post("logout")
  logout(@Body(new ZodPipe(refreshTokenSchema)) dto: RefreshTokenInput) {
    return this.authService.logout(dto.refreshToken);
  }

  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.sub);
  }

  @Post("change-password")
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(changePasswordSchema)) dto: ChangePasswordInput,
  ) {
    return this.authService.changePassword(
      user.sub,
      dto.currentPassword,
      dto.newPassword,
    );
  }
}
