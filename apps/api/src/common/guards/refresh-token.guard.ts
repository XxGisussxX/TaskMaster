import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthService } from "../../modules/auth/auth.service";
import { readRefreshCookie } from "../../modules/auth/auth-cookie";

/**
 * Valida manualmente un refresh token de alta rotación (equivalente a una
 * estrategia passport pero reutilizando el flujo de rotación de AuthService).
 *
 * El token sale de la cookie HttpOnly, no del cuerpo: si aceptara el body
 * seguiría siendo un token que el JavaScript de la página puede leer, que es
 * justo lo que este cambio viene a cerrar.
 */
@Injectable()
export class RefreshTokenGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = readRefreshCookie(request);

    if (!token) {
      throw new UnauthorizedException("Refresh token requerido");
    }

    const session = await this.authService.validateRefreshToken(token);
    request.user = session.user;
    request.refreshToken = token;
    return true;
  }
}
