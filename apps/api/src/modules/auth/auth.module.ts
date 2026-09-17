import { Module } from "@nestjs/common";
import { JwtModule, type JwtSignOptions } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { jwtConstants } from "../../config/env.config";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./jwt.strategy";
import { SessionCleanupService } from "./session-cleanup.service";
import { RefreshTokenGuard } from "../../common/guards/refresh-token.guard";

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.register({
      secret: jwtConstants.accessSecret(),
      signOptions: {
        expiresIn: jwtConstants.accessTtl() as JwtSignOptions["expiresIn"],
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    SessionCleanupService,
    RefreshTokenGuard,
  ],
  exports: [AuthService, JwtModule, RefreshTokenGuard],
})
export class AuthModule {}
