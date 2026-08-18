import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { APP_GUARD } from "@nestjs/core";
import { validateEnv } from "./config/env.config";
import { PrismaModule } from "./prisma/prisma.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
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
import { UploadsModule } from "./modules/uploads/uploads.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env", ".env"],
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
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
    UploadsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
