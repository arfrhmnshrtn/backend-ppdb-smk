import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../lib/prisma.service.js';

@Injectable()
export class AnnouncementsScheduler {
  private readonly logger = new Logger(AnnouncementsScheduler.name);
  private readonly prisma = PrismaService;

  @Cron(CronExpression.EVERY_MINUTE)
  async handleAutoPublish() {
    try {
      const now = new Date();

      const result = await this.prisma.student_announcements.updateMany({
        where: {
          is_published: false,
          published_at: {
            lte: now,
          },
        },
        data: {
          is_published: true,
        },
      });

      if (result.count > 0) {
        this.logger.log(`Berhasil mem-publish ${result.count} pengumuman secara otomatis.`);
      }
    } catch (error) {
      this.logger.error('Terjadi kesalahan saat menjalankan Cron Job publish pengumuman:', error);
    }
  }
}
