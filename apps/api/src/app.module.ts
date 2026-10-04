import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import { validateEnv } from "./config/env.config";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./redis/redis.module";
import { RedisService } from "./redis/redis.service";
import { ThrottlerStorageRedis } from "./redis/throttler-storage-redis";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { MailModule } from "./modules/mail/mail.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { AdminModule } from "./modules/admin/admin.module";
import { WorkspacesModule } from "./modules/workspaces/workspaces.module";
import { TasksModule } from "./modules/tasks/tasks.module";
import { NotesModule } from "./modules/notes/notes.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { HealthModule } from "./modules/health/health.module";
import { ActivityModule } from "./modules/activity/activity.module";
import { TagsModule } from "./modules/tags/tags.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { CommentsModule } from "./modules/comments/comments.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { RemindersModule } from "./modules/reminders/reminders.module";
import { SavedViewsModule } from "./modules/saved-views/saved-views.module";
import { TaskTemplatesModule } from "./modules/task-templates/task-templates.module";
import { UploadsModule } from "./modules/uploads/uploads.module";
import { TaskDependenciesModule } from "./modules/task-dependencies/task-dependencies.module";
import { TimeEntriesModule } from "./modules/time-entries/time-entries.module";
import { CustomFieldsModule } from "./modules/custom-fields/custom-fields.module";
import { AiModule } from "./modules/ai/ai.module";
import { AgendaModule } from "./modules/agenda/agenda.module";
import { WebSocketModule } from "./modules/websocket/websocket.module";
import { TenantModule } from "./tenant/tenant.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env", ".env"],
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProduction = config.get<string>("NODE_ENV") === "production";
        const level =
          config.get<string>("LOG_LEVEL") ?? (isProduction ? "info" : "debug");
        return {
          pinoHttp: {
            level,
            transport: isProduction
              ? undefined
              : {
                  target: "pino-pretty",
                  options: { colorize: true, translateTime: "SYS:standard" },
                },
            redact: {
              paths: [
                "req.headers.authorization",
                "req.headers.cookie",
                "req.body.password",
                "req.body.refreshToken",
              ],
              censor: "[REDACTED]",
            },
            autoLogging: {
              ignore: (req: { url: string }) =>
                req.url === "/api/health/live" ||
                req.url === "/api/health/ready",
            },
          },
        };
      },
    }),
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisService],
      useFactory: (redis: RedisService) => ({
        throttlers: [{ name: "default", ttl: 60_000, limit: 120 }],
        storage: new ThrottlerStorageRedis(redis),
      }),
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    HealthModule,
    MailModule,
    AuthModule,
    UsersModule,
    AdminModule,
    WorkspacesModule,
    TasksModule,
    NotesModule,
    DashboardModule,
    ActivityModule,
    TagsModule,
    CategoriesModule,
    CommentsModule,
    NotificationsModule,
    RemindersModule,
    SavedViewsModule,
    TaskTemplatesModule,
    UploadsModule,
    TaskDependenciesModule,
    TimeEntriesModule,
    CustomFieldsModule,
    AiModule,
    AgendaModule,
    WebSocketModule,
    TenantModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
