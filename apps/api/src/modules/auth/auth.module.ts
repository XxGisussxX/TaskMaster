import { Module } from "@nestjs/common";
import { JwtModule, type JwtSignOptions } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { jwtConstants } from "../../config/env.config";
import { MailModule } from "../mail/mail.module";
import { RedisModule } from "../../redis/redis.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { GoogleOAuthService } from "./google-oauth.service";
import { JwtStrategy } from "./jwt.strategy";
import { SessionCleanupService } from "./session-cleanup.service";
import { LoginLockoutService } from "./login-lockout.service";
import { RefreshTokenGuard } from "../../common/guards/refresh-token.guard";
import { EmailThrottleGuard } from "../../common/guards/email-throttle.guard";

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.register({
      secret: jwtConstants.accessSecret(),
      signOptions: {
        expiresIn: jwtConstants.accessTtl() as JwtSignOptions["expiresIn"],
      },
    }),
    MailModule,
    RedisModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    GoogleOAuthService,
    JwtStrategy,
    SessionCleanupService,
    LoginLockoutService,
    RefreshTokenGuard,
    EmailThrottleGuard,
  ],
  exports: [AuthService, JwtModule, RefreshTokenGuard],
})
export class AuthModule {}
