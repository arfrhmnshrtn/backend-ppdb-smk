import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../lib/prisma.service';
import { ScheduleAnnouncementDto } from './dto/schedule-announcement.dto';
import { SetMajorQuotaDto } from './dto/set-major-quota.dto';
import {
  JalurPenerimaan,
  Jurusan,
  StatusAkhirSeleksi,
  StudentAnnouncementStatus,
} from '../../generated/prisma/client';

const JURUSAN_LABELS: Record<Jurusan, string> = {
  [Jurusan.AK]: 'Akuntansi (AK)',
  [Jurusan.ATP]: 'Agribisnis Tanaman Perkebunan (ATP)',
  [Jurusan.DKV]: 'Desain Komunikasi Visual (DKV)',
  [Jurusan.TKJ]: 'Teknik Komputer Jaringan (TKJ)',
  [Jurusan.TKR]: 'Teknik Kendaraan Ringan (TKR)',
};

const ALL_JURUSAN_LIST: Jurusan[] = [
  Jurusan.AK,
  Jurusan.ATP,
  Jurusan.DKV,
  Jurusan.TKJ,
  Jurusan.TKR,
];

@Injectable()
export class AnnouncementsService {
  private readonly prisma = PrismaService;

  // Default fallback quotas if not yet configured in database
  private readonly defaultQuotas: Record<Jurusan, number> = {
    [Jurusan.TKJ]: 80,
    [Jurusan.TKR]: 100,
    [Jurusan.ATP]: 60,
    [Jurusan.AK]: 60,
    [Jurusan.DKV]: 60,
  };

  /**
   * Mengambil daftar pilihan jurusan dari DB beserta jumlah kuota dan jumlah pendaftar masing-masing jurusan.
   */
  async getMajorQuotas() {
    try {
      const [dbQuotas, studentCounts] = await Promise.all([
        this.prisma.major_quotas.findMany(),
        this.prisma.students.groupBy({
          by: ['jurusan'],
          _count: { id: true },
        }),
      ]);

      const quotaMap = new Map(dbQuotas.map((q) => [q.jurusan, q]));
      const countMap = new Map(
        studentCounts.map((c) => [c.jurusan, c._count.id]),
      );

      const data = ALL_JURUSAN_LIST.map((jurusan) => {
        const record = quotaMap.get(jurusan);
        return {
          id: record?.id ?? null,
          jurusan,
          nama_jurusan: JURUSAN_LABELS[jurusan],
          quota: record ? record.quota : this.defaultQuotas[jurusan],
          is_configured: Boolean(record),
          total_pendaftar: countMap.get(jurusan) ?? 0,
          updated_at: record?.updated_at ?? null,
        };
      });

      return {
        success: true,
        message: 'Berhasil mengambil data kuota jurusan',
        data,
      };
    } catch (error) {
      console.error('Error getMajorQuotas:', error);
      throw new InternalServerErrorException(
        'Gagal mengambil data kuota jurusan',
      );
    }
  }

  /**
   * Menyimpan atau memperbarui kuota untuk jurusan yang dipilih dari dropdown.
   */
  async setMajorQuota(dto: SetMajorQuotaDto) {
    try {
      const saved = await this.prisma.major_quotas.upsert({
        where: { jurusan: dto.jurusan },
        create: {
          jurusan: dto.jurusan,
          quota: dto.quota,
        },
        update: {
          quota: dto.quota,
        },
      });

      return {
        success: true,
        message: `Berhasil menyimpan kuota jurusan ${JURUSAN_LABELS[dto.jurusan]} sebanyak ${dto.quota} siswa`,
        data: {
          id: saved.id,
          jurusan: saved.jurusan,
          nama_jurusan: JURUSAN_LABELS[saved.jurusan],
          quota: saved.quota,
          updated_at: saved.updated_at,
        },
      };
    } catch (error) {
      console.error('Error setMajorQuota:', error);
      throw new InternalServerErrorException(
        'Gagal menyimpan data kuota jurusan',
      );
    }
  }

  private async getEffectiveQuotasMap(): Promise<Record<Jurusan, number>> {
    const dbQuotas = await this.prisma.major_quotas.findMany();
    const effective: Record<Jurusan, number> = { ...this.defaultQuotas };
    for (const item of dbQuotas) {
      effective[item.jurusan] = item.quota;
    }
    return effective;
  }

  async generateAnnouncements() {
    try {
      // 1. Fetch all student rankings (already computed via 2-stage selection)
      const [rankings, quotasMap] = await Promise.all([
        this.prisma.student_ranking.findMany(),
        this.getEffectiveQuotasMap(),
      ]);

      const newAnnouncements: Array<{
        id_student: number;
        status: StudentAnnouncementStatus;
        jurusan_diterima: Jurusan | null;
        jalur_penerimaan: JalurPenerimaan | null;
        is_published: boolean;
      }> = [];

      // 2. Determine status from 2-stage selection result (or fallback to ranking vs quota)
      for (const rank of rankings) {
        let status: StudentAnnouncementStatus =
          StudentAnnouncementStatus.FAILED;
        let jurusanDiterima: Jurusan | null = rank.jurusan_diterima ?? null;
        let jalurPenerimaan: JalurPenerimaan | null =
          rank.jalur_penerimaan ?? null;

        if (rank.status_akhir === StatusAkhirSeleksi.DITERIMA) {
          status = StudentAnnouncementStatus.PASSED;
        } else if (!rank.jalur_penerimaan) {
          const quota = quotasMap[rank.jurusan];
          if (rank.ranking <= quota) {
            status = StudentAnnouncementStatus.PASSED;
            jurusanDiterima = rank.jurusan;
            jalurPenerimaan = JalurPenerimaan.PILIHAN_1;
          }
        }

        newAnnouncements.push({
          id_student: rank.id_student,
          status,
          jurusan_diterima: status === StudentAnnouncementStatus.PASSED ? jurusanDiterima : null,
          jalur_penerimaan: status === StudentAnnouncementStatus.PASSED ? jalurPenerimaan : null,
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
          quotas_used: quotasMap,
        },
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
        },
      });

      return {
        success: true,
        message: 'Berhasil menjadwalkan pengumuman',
        data: {
          total_updated: updateResult.count,
          published_at: publishDate,
        },
      };
    } catch (error) {
      console.error('Error schedulePublish:', error);
      throw new InternalServerErrorException('Gagal menjadwalkan pengumuman');
    }
  }

  async getSchedulePublish() {
    try {
      const announcement = await this.prisma.student_announcements.findFirst({
        select: {
          published_at: true,
        },
        where: {
          published_at: {
            not: null,
          },
        },
      });

      const publishedAt = announcement?.published_at
        ? announcement.published_at.toLocaleString('id-ID', {
            timeZone: 'Asia/Jakarta',
            dateStyle: 'full',
            timeStyle: 'short',
          })
        : null;

      return {
        success: true,
        message: 'Berhasil mengambil jadwal pengumuman',
        data: {
          published_at: publishedAt,
        },
      };
    } catch (error) {
      console.error('Error getSchedulePublish:', error);

      throw new InternalServerErrorException(
        'Gagal mengambil jadwal pengumuman',
      );
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
      const isPublished =
        announcement.is_published ||
        (announcement.published_at &&
          now >= new Date(announcement.published_at));

      if (!isPublished) {
        if (announcement.published_at) {
          const days = [
            'Minggu',
            'Senin',
            'Selasa',
            'Rabu',
            'Kamis',
            'Jumat',
            'Sabtu',
          ];
          const months = [
            'Januari',
            'Februari',
            'Maret',
            'April',
            'Mei',
            'Juni',
            'Juli',
            'Agustus',
            'September',
            'Oktober',
            'November',
            'Desember',
          ];
          const date = new Date(announcement.published_at);
          const hari = days[date.getDay()];
          const tanggal = `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
          const jam = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

          const diffMs = date.getTime() - now.getTime();
          const hours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
          const minutes = Math.max(
            0,
            Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)),
          );
          const seconds = Math.max(
            0,
            Math.floor((diffMs % (1000 * 60)) / 1000),
          );
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
          jurusan_diterima: announcement.jurusan_diterima,
          jalur_penerimaan: announcement.jalur_penerimaan,
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
