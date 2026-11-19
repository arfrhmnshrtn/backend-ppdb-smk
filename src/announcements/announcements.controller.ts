import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { ScheduleAnnouncementDto } from './dto/schedule-announcement.dto';
import { SetMajorQuotaDto } from './dto/set-major-quota.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { user_role } from '../../generated/prisma/client';

@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get('quotas')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(user_role.ADMIN)
  async getMajorQuotas() {
    return this.announcementsService.getMajorQuotas();
  }

  @Post('quotas')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(user_role.ADMIN)
  async setMajorQuotaPost(@Body() dto: SetMajorQuotaDto) {
    return this.announcementsService.setMajorQuota(dto);
  }

  @Patch('quotas')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(user_role.ADMIN)
  async setMajorQuotaPatch(@Body() dto: SetMajorQuotaDto) {
    return this.announcementsService.setMajorQuota(dto);
  }

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

  @Get('schedule')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(user_role.ADMIN)
  async getSchedulePublish() {
    return this.announcementsService.getSchedulePublish();
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async getMyAnnouncement(@Request() req: { user: { sub: number } }) {
    const userId = req.user.sub;
    return this.announcementsService.getMyAnnouncement(userId);
  }
}
