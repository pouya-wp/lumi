import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { ActivityModule } from './activity/activity.module';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { AutomationsModule } from './automations/automations.module';
import { CommentsModule } from './comments/comments.module';
import { AuthGuard } from './common/auth.guard';
import { DashboardModule } from './dashboard/dashboard.module';
import { FieldsModule } from './fields/fields.module';
import { FocusModule } from './focus/focus.module';
import { GoalsModule } from './goals/goals.module';
import { HabitsModule } from './habits/habits.module';
import { MilestonesModule } from './milestones/milestones.module';
import { SprintsModule } from './sprints/sprints.module';
import { TimeModule } from './time/time.module';
import { ViewsModule } from './views/views.module';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { RealtimeModule } from './realtime/realtime.module';
import { TasksModule } from './tasks/tasks.module';
import { WorkspacesModule } from './workspaces/workspaces.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot({ wildcard: false }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET') ?? 'dev-secret-change-me',
        signOptions: { expiresIn: '15m' },
      }),
    }),
    PrismaModule,
    NotificationsModule,
    HealthModule,
    AuthModule,
    WorkspacesModule,
    ProjectsModule,
    TasksModule,
    CommentsModule,
    DashboardModule,
    FieldsModule,
    ViewsModule,
    TimeModule,
    SprintsModule,
    GoalsModule,
    HabitsModule,
    MilestonesModule,
    FocusModule,
    AutomationsModule,
    AiModule,
    ActivityModule,
    RealtimeModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
