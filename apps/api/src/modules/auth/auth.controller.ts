import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  type ChangePasswordInput,
  type ForgotPasswordInput,
  type LoginInput,
  type RegisterInput,
  type ResendVerificationInput,
  type ResetPasswordInput,
  type VerifyEmailInput,
} from "@taskmaster/contracts";
import { Public } from "../../common/decorators/public.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RefreshTokenGuard } from "../../common/guards/refresh-token.guard";
import { EmailThrottleGuard } from "../../common/guards/email-throttle.guard";
import { ZodPipe } from "../../common/pipes/zod.pipe";
import { AuthService } from "./auth.service";
import {
  clearRefreshCookie,
  isProduction,
  readRefreshCookie,
  setRefreshCookie,
  withoutRefreshToken,
} from "./auth-cookie";
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
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  // Doble límite: el @Throttle de arriba cuenta por IP, este guard por email
  // hasheado. Rotar X-Forwarded-For ya no multiplica los intentos.
  @UseGuards(EmailThrottleGuard)
  @Throttle({ default: { limit: 3, ttl: 300_000 } })
  @Post("register")
  async register(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body(new ZodPipe(registerSchema)) dto: RegisterInput,
  ) {
    const session = await this.authService.register(dto, requestMetadata(req));
    setRefreshCookie(res, session.refreshToken, isProduction(this.config));
    return withoutRefreshToken(session);
  }

  @Public()
  @UseGuards(EmailThrottleGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("login")
  async login(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body(new ZodPipe(loginSchema)) dto: LoginInput,
  ) {
    const session = await this.authService.login(dto, requestMetadata(req));
    setRefreshCookie(res, session.refreshToken, isProduction(this.config));
    return withoutRefreshToken(session);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseGuards(RefreshTokenGuard)
  @Post("refresh")
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // El token sale de la cookie: ya lo validó el guard.
    const token = readRefreshCookie(req);
    if (!token) throw new UnauthorizedException("Refresh token requerido");

    const session = await this.authService.refresh(token, requestMetadata(req));
    // La rotación emite un token nuevo: la cookie vieja ya no sirve.
    setRefreshCookie(res, session.refreshToken, isProduction(this.config));
    return withoutRefreshToken(session);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 300_000 } })
  @Post("verify-email")
  verifyEmail(@Body(new ZodPipe(verifyEmailSchema)) dto: VerifyEmailInput) {
    return this.authService.verifyEmail(dto.token);
  }

  @Public()
  @UseGuards(EmailThrottleGuard)
  @Throttle({ default: { limit: 5, ttl: 300_000 } })
  @Post("resend-verification")
  resendVerification(
    @Body(new ZodPipe(resendVerificationSchema)) dto: ResendVerificationInput,
  ) {
    return this.authService.resendVerification(dto.email);
  }

  @Public()
  @UseGuards(EmailThrottleGuard)
  @Throttle({ default: { limit: 5, ttl: 300_000 } })
  @Post("forgot-password")
  forgotPassword(
    @Body(new ZodPipe(forgotPasswordSchema)) dto: ForgotPasswordInput,
  ) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 300_000 } })
  @Post("reset-password")
  resetPassword(
    @Body(new ZodPipe(resetPasswordSchema)) dto: ResetPasswordInput,
  ) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @Post("logout")
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = readRefreshCookie(req);
    // Aun sin cookie hay que limpiar: si al cliente le quedó una cookie vieja
    // con otros atributos, el logout igual tiene que reportarse exitoso para
    // que el front limpie su sesión en memoria.
    clearRefreshCookie(res, isProduction(this.config));
    if (!token) return { success: true };
    return this.authService.logout(token);
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
