import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../lib/prisma.service.js';
import { ScheduleAnnouncementDto } from './dto/schedule-announcement.dto';
import { Jurusan, StudentAnnouncementStatus } from '../../generated/prisma/client';

@Injectable()
export class AnnouncementsService {
  private readonly prisma = PrismaService;

  // Quotas for each Jurusan
  private readonly quotas: Record<Jurusan, number> = {
    [Jurusan.TKJ]: 80,
    [Jurusan.TKR]: 100,
    [Jurusan.ATP]: 60,
    [Jurusan.AK]: 60,
    [Jurusan.DKV]: 60,
  };

  async generateAnnouncements() {
    try {
      // 1. Fetch all student rankings
      const rankings = await this.prisma.student_ranking.findMany();

      const newAnnouncements: Array<{
        id_student: number;
        status: StudentAnnouncementStatus;
        is_published: boolean;
      }> = [];

      // 2. Determine status based on ranking and quota
      for (const rank of rankings) {
        const quota = this.quotas[rank.jurusan];
        let status: StudentAnnouncementStatus = StudentAnnouncementStatus.FAILED;

        if (rank.ranking <= quota) {
          status = StudentAnnouncementStatus.PASSED;
        }

        newAnnouncements.push({
          id_student: rank.id_student,
          status,
          is_published: false,
        });
      }

      // 3. Delete old announcements and create new ones in a transaction
      await this.prisma.$transaction(async (tx) => {
        await tx.student_announcements.deleteMany({});

        if (newAnnouncements.length > 0) {
          await tx.student_announcements.createMany({
            data: newAnnouncements,
          });
        }
      });

      return {
        success: true,
        message: 'Berhasil meng-generate pengumuman kelulusan',
        data: {
          total_generated: newAnnouncements.length,
        }
      };
    } catch (error) {
      console.error('Error generateAnnouncements:', error);
      throw new InternalServerErrorException('Gagal meng-generate pengumuman');
    }
  }

  async schedulePublish(dto: ScheduleAnnouncementDto) {
    try {
      const publishDate = new Date(dto.published_at);

      const updateResult = await this.prisma.student_announcements.updateMany({
        data: {
          published_at: publishDate,
        }
      });

      return {
        success: true,
        message: 'Berhasil menjadwalkan pengumuman',
        data: {
          total_updated: updateResult.count,
          published_at: publishDate,
        }
      };
    } catch (error) {
      console.error('Error schedulePublish:', error);
      throw new InternalServerErrorException('Gagal menjadwalkan pengumuman');
    }
  }

  async getMyAnnouncement(userId: number) {
    try {
      const student = await this.prisma.students.findUnique({
        where: { id_user: userId },
      });

      if (!student) {
        throw new NotFoundException('Data siswa tidak ditemukan');
      }

      const announcement = await this.prisma.student_announcements.findUnique({
        where: { id_student: student.id },
      });

      if (!announcement) {
        return {
          success: false,
          message: 'Pengumuman belum tersedia',
        };
      }

      const now = new Date();
      const isPublished = announcement.is_published || (announcement.published_at && now >= new Date(announcement.published_at));

      if (!isPublished) {
        if (announcement.published_at) {
          const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
          const months = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
          ];
          const date = new Date(announcement.published_at);
          const hari = days[date.getDay()];
          const tanggal = `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
          const jam = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

          const diffMs = date.getTime() - now.getTime();
          const hours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
          const minutes = Math.max(0, Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)));
          const seconds = Math.max(0, Math.floor((diffMs % (1000 * 60)) / 1000));
          const countdown = `${hours} jam, ${minutes} menit, ${seconds} detik lagi`;

          return {
            success: false,
            message: 'Pengumuman belum tersedia',
            data: {
              hari,
              tanggal,
              jam,
              published_at: announcement.published_at,
              countdown,
            },
          };
        }

        return {
          success: false,
          message: 'Pengumuman belum tersedia',
        };
      }

      return {
        success: true,
        data: {
          status: announcement.status,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error getMyAnnouncement:', error);
      throw new InternalServerErrorException('Gagal mengambil data pengumuman');
    }
  }
}
