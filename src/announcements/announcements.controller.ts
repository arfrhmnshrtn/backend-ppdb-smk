import { Controller, Post, Patch, Get, Body, UseGuards, Request } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { ScheduleAnnouncementDto } from './dto/schedule-announcement.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { user_role } from '../../generated/prisma/client';

@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) { }

  @Post('generate')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(user_role.ADMIN)
  async generateAnnouncements() {
    return this.announcementsService.generateAnnouncements();
  }

  @Patch('schedule')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(user_role.ADMIN)
  async schedulePublish(@Body() dto: ScheduleAnnouncementDto) {
    return this.announcementsService.schedulePublish(dto);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async getMyAnnouncement(@Request() req: any) {
    const userId = req.user.sub;
    return this.announcementsService.getMyAnnouncement(userId);
  }
}
