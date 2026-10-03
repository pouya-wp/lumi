import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({ imports: [WorkspacesModule], controllers: [AuthController], providers: [AuthService] })
export class AuthModule {}
