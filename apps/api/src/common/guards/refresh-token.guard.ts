import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthService } from "../../modules/auth/auth.service";

/**
 * Valida manualmente un refresh token de alta rotación (equivalente a una
 * estrategia passport pero reutilizando el flujo de rotación de AuthService).
 */
@Injectable()
export class RefreshTokenGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.body?.refreshToken as string | undefined;

    if (!token) {
      throw new UnauthorizedException("Refresh token requerido");
    }

    const session = await this.authService.validateRefreshToken(token);
    request.user = session.user;
    request.refreshToken = token;
    return true;
  }
}
