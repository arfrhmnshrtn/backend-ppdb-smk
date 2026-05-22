import { Module } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service.js';
import { AnnouncementsController } from './announcements.controller.js';
import { AnnouncementsScheduler } from './announcements.scheduler.js';
import { JwtService } from '@nestjs/jwt';

@Module({
  controllers: [AnnouncementsController],
  providers: [AnnouncementsService, AnnouncementsScheduler, JwtService],
})
export class AnnouncementsModule { }
