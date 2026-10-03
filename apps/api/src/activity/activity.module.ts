import { Module } from '@nestjs/common';
import { ActivityListener } from './activity.listener';

@Module({ providers: [ActivityListener] })
export class ActivityModule {}
