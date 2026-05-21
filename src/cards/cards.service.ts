import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../lib/prisma.service';
import { VerificationStatus } from '../../generated/prisma/client';
import { PdfGeneratorService } from './pdf/pdf-generator.service';
import { generateCardHtml } from './templates/card.template';
import { formatTanggalIndonesia } from './helpers/format-date.helper';
import { CreateTestScheduleDto } from './dto/create-test-schedule.dto';

/**
 * Service untuk mengelola kartu pendaftaran PPDB.
 *
 * Kenapa user diambil dari JWT dan bukan dari params/query?
 * - Mencegah IDOR (Insecure Direct Object Reference): jika studentId
 *   dikirim via params, siswa bisa mengganti ID di URL dan mengakses
 *   kartu milik siswa lain.
 * - JWT adalah satu-satunya sumber identitas yang terverifikasi oleh server.
 *
 * Kenapa PDF dan bukan HTML biasa?
 * - PDF memiliki layout yang konsisten di semua device dan printer.
 * - PDF bisa langsung dicetak tanpa risiko perubahan layout akibat browser.
 * - PDF bisa disimpan offline dan dikirim via email/WA.
 * - PDF lebih sulit dimanipulasi dibanding HTML mentah.
 */
@Injectable()
export class CardsService {
  private readonly prisma = PrismaService;

  constructor(private readonly pdfGenerator: PdfGeneratorService) {}

  /**
   * Mengambil data kartu pendaftaran milik siswa yang sedang login.
   * Ownership divalidasi melalui userId dari JWT token.
   */
  async getMyCard(userId: number) {
    try {
      // 1. Ambil data siswa berdasarkan id_user dari JWT (anti-IDOR)
      const student = await this.prisma.students.findUnique({
        where: { id_user: userId },
        select: {
          id: true,
          no_daftar: true,
          nama: true,
          jurusan: true,
          nisn: true,
          asal_sekolah: true,
          alamat: true,
          verification_status: true,
          documents: {
            where: {
              document_type: {
                name: 'pas_foto',
              },
            },
            select: {
              file_path: true,
            },
          },
        },
      });

      if (!student) {
        throw new NotFoundException('Data pendaftaran tidak ditemukan');
      }

      // 2. Cek apakah berkas sudah TERVERIFIKASI
      if (student.verification_status !== VerificationStatus.TERVERIFIKASI) {
        return {
          success: false,
          message: 'Berkas belum terverifikasi',
        };
      }

      // 3. Ambil jadwal test terbaru
      const schedule = await this.prisma.test_schedules.findFirst({
        orderBy: { created_at: 'desc' },
      });

      if (!schedule) {
        return {
          success: false,
          message: 'Jadwal test belum tersedia. Silakan hubungi panitia.',
        };
      }

      // 4. Return data kartu
      const pasFotoDoc = student.documents?.[0];
      const pasFotoPath = pasFotoDoc ? pasFotoDoc.file_path : null;
      const fotoUrl = pasFotoPath
        ? `${process.env.BASE_URL || 'http://localhost:3000'}${pasFotoPath.replace(/^\/uploads/, '/files')}`
        : null;

      return {
        success: true,
        message: 'Kartu pendaftaran berhasil diambil',
        data: {
          no_daftar: student.no_daftar,
          nama: student.nama,
          foto: fotoUrl,
          jurusan: student.jurusan,
          nisn: student.nisn,
          asal_sekolah: student.asal_sekolah,
          alamat: student.alamat,
          tanggal_test: formatTanggalIndonesia(schedule.tanggal_test),
          jam_test: schedule.jam_test,
          lokasi_test: schedule.lokasi_test,
        },
      };
    } catch (error) {
      this.handleException(error, 'Gagal mengambil data kartu pendaftaran');
    }
  }

  /**
   * Men-generate dan mengembalikan buffer PDF kartu pendaftaran.
   * Dipanggil oleh controller untuk di-stream sebagai file download.
   */
  async downloadMyCard(userId: number): Promise<{ buffer: Buffer; filename: string }> {
    try {
      // 1. Ambil data siswa (anti-IDOR via JWT userId)
      const student = await this.prisma.students.findUnique({
        where: { id_user: userId },
        select: {
          no_daftar: true,
          nama: true,
          jurusan: true,
          nisn: true,
          asal_sekolah: true,
          alamat: true,
          verification_status: true,
          documents: {
            where: {
              document_type: {
                name: 'pas_foto',
              },
            },
            select: {
              file_path: true,
            },
          },
        },
      });

      if (!student) {
        throw new NotFoundException('Data pendaftaran tidak ditemukan');
      }

      // 2. Cek verifikasi — siswa HARUS terverifikasi untuk download
      if (student.verification_status !== VerificationStatus.TERVERIFIKASI) {
        throw new ForbiddenException(
          'Berkas belum terverifikasi. Kartu pendaftaran tidak dapat diunduh.',
        );
      }

      // 3. Ambil jadwal test terbaru
      const schedule = await this.prisma.test_schedules.findFirst({
        orderBy: { created_at: 'desc' },
      });

      if (!schedule) {
        throw new NotFoundException(
          'Jadwal test belum tersedia. Kartu tidak dapat di-generate.',
        );
      }

      // 4. Buat foto URL lengkap atau null
      const pasFotoDoc = student.documents?.[0];
      const pasFotoPath = pasFotoDoc ? pasFotoDoc.file_path : null;
      const fotoUrl = pasFotoPath
        ? `${process.env.BASE_URL || 'http://localhost:3000'}${pasFotoPath.replace(/^\/uploads/, '/files')}`
        : null;

      // 5. Generate HTML dari template
      const html = generateCardHtml({
        no_daftar: student.no_daftar,
        nama: student.nama,
        foto: fotoUrl,
        jurusan: student.jurusan,
        nisn: student.nisn,
        asal_sekolah: student.asal_sekolah,
        alamat: student.alamat,
        tanggal_test: formatTanggalIndonesia(schedule.tanggal_test),
        jam_test: schedule.jam_test,
        lokasi_test: schedule.lokasi_test,
      });

      // 6. Generate PDF via Puppeteer
      const pdfBuffer = await this.pdfGenerator.generatePdfFromHtml(html);

      // 7. Buat filename yang aman (hilangkan spasi dan karakter khusus)
      const safeName = student.nama.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const filename = `kartu_pendaftaran_${safeName}_${student.no_daftar}.pdf`;

      return { buffer: pdfBuffer, filename };
    } catch (error) {
      this.handleException(error, 'Gagal men-generate PDF kartu pendaftaran');
    }
  }

  // ==================== ADMIN: CRUD Jadwal Test ====================

  /**
   * Membuat jadwal test baru.
   */
  async createTestSchedule(dto: CreateTestScheduleDto) {
    try {
      const schedule = await this.prisma.test_schedules.create({
        data: {
          tanggal_test: new Date(dto.tanggal_test),
          jam_test: dto.jam_test,
          lokasi_test: dto.lokasi_test,
        },
      });

      return {
        success: true,
        message: 'Jadwal test berhasil dibuat',
        data: {
          ...schedule,
          tanggal_test_formatted: formatTanggalIndonesia(schedule.tanggal_test),
        },
      };
    } catch (error) {
      this.handleException(error, 'Gagal membuat jadwal test');
    }
  }

  /**
   * Mengambil seluruh jadwal test.
   */
  async findAllTestSchedules() {
    try {
      const schedules = await this.prisma.test_schedules.findMany({
        orderBy: { tanggal_test: 'asc' },
      });

      return {
        success: true,
        message: 'Data jadwal test berhasil diambil',
        total: schedules.length,
        data: schedules.map((s) => ({
          ...s,
          tanggal_test_formatted: formatTanggalIndonesia(s.tanggal_test),
        })),
      };
    } catch (error) {
      this.handleException(error, 'Gagal mengambil data jadwal test');
    }
  }

  /**
   * Memperbarui jadwal test berdasarkan ID.
   */
  async updateTestSchedule(id: number, dto: CreateTestScheduleDto) {
    try {
      const existing = await this.prisma.test_schedules.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new NotFoundException(`Jadwal test dengan ID ${id} tidak ditemukan`);
      }

      const updated = await this.prisma.test_schedules.update({
        where: { id },
        data: {
          tanggal_test: new Date(dto.tanggal_test),
          jam_test: dto.jam_test,
          lokasi_test: dto.lokasi_test,
        },
      });

      return {
        success: true,
        message: 'Jadwal test berhasil diperbarui',
        data: {
          ...updated,
          tanggal_test_formatted: formatTanggalIndonesia(updated.tanggal_test),
        },
      };
    } catch (error) {
      this.handleException(error, 'Gagal memperbarui jadwal test');
    }
  }

  /**
   * Menghapus jadwal test berdasarkan ID.
   */
  async removeTestSchedule(id: number) {
    try {
      const existing = await this.prisma.test_schedules.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new NotFoundException(`Jadwal test dengan ID ${id} tidak ditemukan`);
      }

      await this.prisma.test_schedules.delete({ where: { id } });

      return {
        success: true,
        message: 'Jadwal test berhasil dihapus',
      };
    } catch (error) {
      this.handleException(error, 'Gagal menghapus jadwal test');
    }
  }

  /**
   * Reusable exception handler.
   */
  private handleException(error: unknown, defaultMessage: string): never {
    if (
      error instanceof NotFoundException ||
      error instanceof ForbiddenException ||
      error instanceof ConflictException
    ) {
      throw error;
    }
    console.error(defaultMessage, error);
    throw new InternalServerErrorException(defaultMessage);
  }
}
