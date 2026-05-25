import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../lib/prisma.service';
import { CreateRaporScoreDto } from './dto/create-rapor-score.dto';
import { UpdateRaporScoreDto } from './dto/update-rapor-score.dto';
import { QueryRaporStatusDto, RaporStatus } from './dto/query-rapor-status.dto';
import { Prisma } from '../../generated/prisma/client';

/**
 * Mapping akreditasi sekolah ke persentase bobot.
 * A = 100%, B = 97.5%, C = 95%, selain itu = 90%
 */
const AKREDITASI_PERCENTAGE: Record<string, number> = {
  A: 1.0,
  B: 0.975,
  C: 0.95,
};
const DEFAULT_AKREDITASI_PERCENTAGE = 0.9;

@Injectable()
export class RaporScoresService {
  private readonly prisma = PrismaService;

  /**
   * Mengambil persentase akreditasi berdasarkan string dari database.
   */
  private getAkreditasiPercentage(akreditasi: string): number {
    return (
      AKREDITASI_PERCENTAGE[akreditasi.toUpperCase()] ??
      DEFAULT_AKREDITASI_PERCENTAGE
    );
  }

  /**
   * Menghitung rata_rata dan nilai_akhir berdasarkan data semester,
   * prestasi, dan akreditasi sekolah siswa.
   */
  private calculateScores(
    semester1: number,
    semester2: number,
    semester3: number,
    semester4: number,
    semester5: number,
    prestasi: number,
    akreditasiSekolah: string,
  ): { rata_rata: number; nilai_akhir: number } {
    // 1. Hitung rata-rata semester 1–5
    const rataRata =
      (semester1 + semester2 + semester3 + semester4 + semester5) / 5;

    // 2. Tambahkan prestasi ke rata-rata
    const nilaiTotal = rataRata + prestasi;

    // 3. Kalikan dengan persentase akreditasi
    const persentase = this.getAkreditasiPercentage(akreditasiSekolah);
    const nilaiAkhir = nilaiTotal * persentase;

    // Bulatkan ke 2 desimal untuk konsistensi data
    return {
      rata_rata: Math.round(rataRata * 100) / 100,
      nilai_akhir: Math.round(nilaiAkhir * 100) / 100,
    };
  }

  /**
   * CREATE – Membuat data rapor baru untuk seorang siswa.
   * Validasi:
   *  - Siswa harus terdaftar di database.
   *  - Siswa belum memiliki data rapor (unique constraint).
   */
  async create(dto: CreateRaporScoreDto) {
    try {
      // 1. Pastikan siswa terdaftar & ambil akreditasi
      const student = await this.prisma.students.findUnique({
        where: { id: dto.id_student },
        select: { id: true, akreditasi_sekolah: true },
      });

      if (!student) {
        throw new NotFoundException(
          `Siswa dengan ID ${dto.id_student} tidak ditemukan`,
        );
      }

      // 2. Cek apakah data rapor sudah ada
      const existingRapor = await this.prisma.raporScore.findUnique({
        where: { id_student: dto.id_student },
      });

      if (existingRapor) {
        throw new ConflictException(
          `Siswa dengan ID ${dto.id_student} sudah memiliki data rapor`,
        );
      }

      // 3. Hitung nilai
      const { rata_rata, nilai_akhir } = this.calculateScores(
        dto.semester_1,
        dto.semester_2,
        dto.semester_3,
        dto.semester_4,
        dto.semester_5,
        dto.prestasi,
        student.akreditasi_sekolah,
      );

      // 4. Simpan ke database
      const raporScore = await this.prisma.raporScore.create({
        data: {
          id_student: dto.id_student,
          semester_1: dto.semester_1,
          semester_2: dto.semester_2,
          semester_3: dto.semester_3,
          semester_4: dto.semester_4,
          semester_5: dto.semester_5,
          prestasi: dto.prestasi,
          rata_rata,
          nilai_akhir,
        },
        include: {
          student: {
            select: { nama: true, akreditasi_sekolah: true },
          },
        },
      });

      return {
        success: true,
        message: 'Data rapor berhasil dibuat',
        data: raporScore,
      };
    } catch (error) {
      this.handleException(error, 'Gagal membuat data rapor');
    }
  }

  /**
   * READ ALL – Mengambil seluruh data rapor dengan relasi student.
   */
  async findAll() {
    try {
      const raporScores = await this.prisma.raporScore.findMany({
        include: {
          student: {
            select: {
              nama: true,
              asal_sekolah: true,
              akreditasi_sekolah: true,
              jurusan: true,
            },
          },
        },
        orderBy: { nilai_akhir: 'desc' },
      });

      return {
        success: true,
        message: 'Data rapor berhasil diambil',
        total: raporScores.length,
        data: raporScores,
      };
    } catch (error) {
      this.handleException(error, 'Gagal mengambil data rapor');
    }
  }

  /**
   * READ ONE – Mengambil satu data rapor berdasarkan ID.
   */
  async findOne(id: number) {
    try {
      const raporScore = await this.prisma.raporScore.findUnique({
        where: { id },
        include: {
          student: {
            select: {
              nama: true,
              asal_sekolah: true,
              akreditasi_sekolah: true,
              jurusan: true,
            },
          },
        },
      });

      if (!raporScore) {
        throw new NotFoundException(
          `Data rapor dengan ID ${id} tidak ditemukan`,
        );
      }

      return {
        success: true,
        message: 'Data rapor ditemukan',
        data: raporScore,
      };
    } catch (error) {
      this.handleException(error, 'Gagal mengambil data rapor');
    }
  }

  /**
   * UPDATE – Memperbarui data rapor.
   * Menghitung ulang rata_rata dan nilai_akhir secara otomatis
   * berdasarkan data baru yang di-merge dengan data lama.
   */
  async update(id: number, dto: UpdateRaporScoreDto) {
    try {
      // 1. Ambil data rapor lama beserta akreditasi siswa
      const existingRapor = await this.prisma.raporScore.findUnique({
        where: { id },
        include: {
          student: {
            select: { akreditasi_sekolah: true },
          },
        },
      });

      if (!existingRapor) {
        throw new NotFoundException(
          `Data rapor dengan ID ${id} tidak ditemukan`,
        );
      }

      // 2. Merge data lama dengan data baru (PartialType)
      const semester1 = dto.semester_1 ?? existingRapor.semester_1;
      const semester2 = dto.semester_2 ?? existingRapor.semester_2;
      const semester3 = dto.semester_3 ?? existingRapor.semester_3;
      const semester4 = dto.semester_4 ?? existingRapor.semester_4;
      const semester5 = dto.semester_5 ?? existingRapor.semester_5;
      const prestasi = dto.prestasi ?? existingRapor.prestasi;

      // 3. Hitung ulang nilai
      const { rata_rata, nilai_akhir } = this.calculateScores(
        semester1,
        semester2,
        semester3,
        semester4,
        semester5,
        prestasi,
        existingRapor.student.akreditasi_sekolah,
      );

      // 4. Update database
      const updatedRapor = await this.prisma.raporScore.update({
        where: { id },
        data: {
          semester_1: semester1,
          semester_2: semester2,
          semester_3: semester3,
          semester_4: semester4,
          semester_5: semester5,
          prestasi,
          rata_rata,
          nilai_akhir,
        },
        include: {
          student: {
            select: { nama: true, akreditasi_sekolah: true },
          },
        },
      });

      return {
        success: true,
        message: 'Data rapor berhasil diperbarui',
        data: updatedRapor,
      };
    } catch (error) {
      this.handleException(error, 'Gagal memperbarui data rapor');
    }
  }

  /**
   * DELETE – Menghapus data rapor berdasarkan ID.
   */
  async remove(id: number) {
    try {
      const existingRapor = await this.prisma.raporScore.findUnique({
        where: { id },
      });

      if (!existingRapor) {
        throw new NotFoundException(
          `Data rapor dengan ID ${id} tidak ditemukan`,
        );
      }

      await this.prisma.raporScore.delete({
        where: { id },
      });

      return {
        success: true,
        message: 'Data rapor berhasil dihapus',
      };
    } catch (error) {
      this.handleException(error, 'Gagal menghapus data rapor');
    }
  }

  /**
   * Mengambil data siswa berdasarkan status input nilai rapor.
   * Mendukung pencarian, filter jurusan, dan pagination.
   */
  async findStudentsByStatus(query: QueryRaporStatusDto) {
    try {
      const { status, page = 1, limit = 10, search, jurusan } = query;
      const skip = (page - 1) * limit;

      const whereClause: Prisma.studentsWhereInput = {};

      if (status === RaporStatus.SUDAH) {
        whereClause.raporScores = {
          some: {},
        };
      } else if (status === RaporStatus.BELUM) {
        whereClause.raporScores = {
          none: {},
        };
      }

      if (search) {
        whereClause.OR = [
          { nama: { contains: search } },
          { nisn: { contains: search } },
        ];
      }

      if (jurusan) {
        whereClause.jurusan = jurusan;
      }

      const [total, data] = await Promise.all([
        this.prisma.students.count({ where: whereClause }),
        this.prisma.students.findMany({
          where: whereClause,
          skip,
          take: limit,
          include: {
            raporScores: true,
          },
          orderBy: {
            nama: 'asc',
          },
        }),
      ]);

      return {
        success: true,
        message: `Berhasil mengambil data siswa dengan status rapor ${status}`,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
        data,
      };
    } catch (error) {
      this.handleException(error, 'Gagal mengambil data status rapor siswa');
    }
  }

  /**
   * Reusable exception handler — melempar ulang NestJS exceptions,
   * membungkus error tak terduga dalam InternalServerErrorException.
   */
  private handleException(error: unknown, defaultMessage: string): never {
    if (
      error instanceof NotFoundException ||
      error instanceof ConflictException
    ) {
      throw error;
    }

    // Tangani unique constraint violation dari Prisma
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Data rapor untuk siswa ini sudah ada');
    }

    console.error(defaultMessage, error);
    throw new InternalServerErrorException(defaultMessage);
  }
}
