import {
  Body,
  ConflictException,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { randomBytes } from "node:crypto";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  OAUTH_PROVIDERS,
  oauthExchangeSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  type ChangePasswordInput,
  type ForgotPasswordInput,
  type LoginInput,
  type OauthErrorCode,
  type OauthExchangeInput,
  type OauthProvider,
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
  clearOAuthStateCookie,
  clearRefreshCookie,
  isProduction,
  readOAuthStateCookie,
  readRefreshCookie,
  setRefreshCookie,
  withoutRefreshToken,
  OAUTH_COOKIE_PATH,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_TTL_MS,
} from "./auth-cookie";
import { GOOGLE_PROVIDER, GoogleOAuthService } from "./google-oauth.service";
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
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
    private readonly googleOAuth: GoogleOAuthService,
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

  // `@Public` a propósito: si dependiera del access token, un logout con el
  // token ya vencido nunca llegaría al handler y la cookie `tm_refresh`
  // sobreviviría al cierre de sesión, lista para revivir la sesión en el
  // próximo arranque. Lo único que hace es revocar el token de la cookie del
  // propio cliente, así que no abre superficie: `SameSite=Strict` impide que
  // un POST desde otro origen la traiga.
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
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

  // ── OAuth ────────────────────────────────────────────────────────────

  /**
   * Qué proveedores de login federado hay operativos.
   *
   * El frontend lo consulta antes de dibujar el botón. Sin esto habría dos
   * opciones malas: mostrar siempre el botón y que falle en el callback, o
   * duplicar la configuración en el front con una variable de Vite que puede
   * desincronizarse de la del servidor.
   */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get("oauth/providers")
  oauthProviders(): { providers: OauthProvider[] } {
    return { providers: this.googleOAuth.isEnabled() ? [GOOGLE_PROVIDER] : [] };
  }

  /**
   * Punto de partida del flujo: redirige a la pantalla de consentimiento.
   *
   * El `state` se genera acá y se guarda en una cookie HttpOnly. El callback lo
   * compara con el que viene por query, que es lo que impide que alguien
   * inyecte su propio `code` reusando el de otra persona.
   *
   * `SameSite=Lax` y no `Strict`: la redirección *vuelve* desde Google, y con
   * `Strict` el navegador no mandaría la cookie en esa navegación cross-site, y
   * el callback fallaría siempre. `Lax` sí la manda en GET de navegación
   * superior, que es el único caso que necesitamos, y sigue cortando los POST
   * cross-site que son la superficie real de CSRF.
   */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get("oauth/:provider/authorize")
  authorize(
    @Param("provider") providerParam: string,
    @Res() res: Response,
  ): void {
    // 404 temprano para un proveedor desconocido, en vez de redirigir a la
    // pantalla de consentimiento de Google y fallar recién en el callback.
    this.parseProvider(providerParam);
    const state = randomBytes(32).toString("base64url");

    res.cookie(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: isProduction(this.config),
      sameSite: "lax",
      path: OAUTH_COOKIE_PATH,
      maxAge: OAUTH_STATE_TTL_MS,
    });

    res.redirect(this.googleOAuth.buildAuthorizeUrl(state));
  }

  /**
   * Callback de Google. No devuelve JSON: redirige al frontend.
   *
   * El token de sesión nunca pasa por acá. Se crea un token de handoff de un
   * solo uso y se manda al frontend en la URL, que lo canjea por la sesión en un
   * POST. Si el access token fuera en la URL quedaría en el historial del
   * navegador y en los logs del proxy.
   *
   * Los errores también van por query, como código de un enum cerrado: el texto
   * lo elige el frontend para poder traducirlo, y así un `error=` arbitrario en
   * la URL no se renderiza.
   */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get("oauth/:provider/callback")
  async callback(
    @Param("provider") providerParam: string,
    @Query("state") state: string | undefined,
    @Query("code") code: string | undefined,
    @Query("error") oauthError: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const provider = this.parseProvider(providerParam);
    const production = isProduction(this.config);
    const webUrl = (this.config.get<string>("WEB_URL") ?? "").replace(
      /\/+$/,
      "",
    );

    // La cookie se borra siempre, aunque el flujo falle: si no, un `state` viejo
    // sobrevive y el siguiente intento hereda un token ya usado.
    const fail = (error: OauthErrorCode): void => {
      clearOAuthStateCookie(res, production);
      res.redirect(`${webUrl}/auth/callback?error=${error}`);
    };

    if (oauthError) {
      // El usuario canceló en la pantalla de Google. No es un error de la app.
      this.logger.log(`Login con ${provider} cancelado en el proveedor`);
      return fail("access_denied");
    }

    const expected = readOAuthStateCookie(req);
    clearOAuthStateCookie(res, production);

    if (!state || !expected || state !== expected) {
      this.logger.warn(
        `Login con ${provider}: state inválido (ip=${req.ip}). Puede ser un callback reenviado o un intento de CSRF.`,
      );
      return fail("invalid_state");
    }
    if (!code) {
      return fail("provider_error");
    }

    let profile;
    try {
      profile = await this.googleOAuth.fetchProfile(code);
    } catch (error) {
      this.logger.error(
        `Login con ${provider}: canje fallido: ${String(error)}`,
      );
      return fail("exchange_failed");
    }

    let userId: string;
    let created: boolean;
    try {
      ({ userId, created } = await this.googleOAuth.resolveUser(profile));
    } catch (error) {
      if (error instanceof ConflictException) return fail("account_conflict");
      if (error instanceof UnauthorizedException)
        return fail("email_unverified");
      throw error;
    }

    const handoff = await this.googleOAuth.createHandoffToken(userId);
    this.logger.log(
      `Login con ${provider} OK (user=${userId}, nueva=${created}, ip=${req.ip})`,
    );
    res.redirect(
      `${webUrl}/auth/callback?token=${encodeURIComponent(handoff)}`,
    );
  }

  /**
   * Canjea el token de handoff por la sesión. Devuelve exactamente lo mismo que
   * `/auth/login`: mismo cuerpo, misma cookie de refresh, mismo refresh token
   * rotado. Para el frontend, iniciar sesión con Google es indistinguible de
   * haber puesto la contraseña.
   */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("oauth/exchange")
  async exchange(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body(new ZodPipe(oauthExchangeSchema)) dto: OauthExchangeInput,
  ) {
    const userId = await this.googleOAuth.consumeHandoffToken(dto.token);
    const session = await this.authService.issueSessionFor(
      userId,
      requestMetadata(req),
    );
    setRefreshCookie(res, session.refreshToken, isProduction(this.config));
    return withoutRefreshToken(session);
  }

  private parseProvider(value: string): OauthProvider {
    if (!OAUTH_PROVIDERS.includes(value as OauthProvider)) {
      throw new NotFoundException(`Proveedor de login desconocido: ${value}`);
    }
    if (value !== GOOGLE_PROVIDER) {
      throw new NotFoundException(
        `Proveedor de login no implementado: ${value}`,
      );
    }
    return value;
  }
}
