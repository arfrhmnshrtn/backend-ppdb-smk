import {
  ConflictException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../lib/prisma.service';
import { QueryRankingDto } from './dto/query-ranking.dto';
import {
  JalurPenerimaan,
  Jurusan,
  Prisma,
  StatusAkhirSeleksi,
  StudentAnnouncementStatus,
  VerificationStatus,
} from '../../generated/prisma/client';

export interface SelectionCandidate {
  id_student: number;
  no_daftar: string;
  nama: string;
  jurusan_pilihan_1: Jurusan;
  jurusan_pilihan_2: Jurusan | null;
  final_score: number;
  nilai_rapor: number;
  nilai_rata_rata_rapor: number;
  nilai_ujian: number;
}

export interface SelectionResultRow {
  id_student: number;
  final_score: number;
  nilai_rapor: number;
  nilai_rata_rata_rapor: number;
  nilai_ujian: number;
  ranking: number;
  jurusan: Jurusan;
  jurusan_pilihan_1: Jurusan;
  jurusan_pilihan_2: Jurusan | null;
  jurusan_diterima: Jurusan | null;
  jalur_penerimaan: JalurPenerimaan | null;
  status_akhir: StatusAkhirSeleksi;
}

export interface MajorQuotaSummary {
  jurusan: Jurusan;
  kuota_total: number;
  diterima_pilihan_1: number;
  diterima_pilihan_2: number;
  kuota_terisi: number;
  sisa_kuota: number;
}

const ALL_MAJORS: Jurusan[] = [
  Jurusan.AK,
  Jurusan.ATP,
  Jurusan.DKV,
  Jurusan.TKJ,
  Jurusan.TKR,
];

const DEFAULT_QUOTAS: Record<Jurusan, number> = {
  [Jurusan.TKJ]: 80,
  [Jurusan.TKR]: 100,
  [Jurusan.ATP]: 60,
  [Jurusan.AK]: 60,
  [Jurusan.DKV]: 60,
};

@Injectable()
export class RankingsService {
  private readonly prisma = PrismaService;
  private isSelectionRunning = false;

  /**
   * Comparator ranking:
   * 1. Nilai akhir tertinggi
   * 2. Nilai rapor tertinggi (RaporScore.nilai_akhir)
   * 3. Nilai rata-rata akhir rapor tertinggi (RaporScore.rata_rata)
   * 4. Tie-breaker deterministik: id_student terkecil
   */
  private compareCandidates(
    a: SelectionCandidate,
    b: SelectionCandidate,
  ): number {
    if (b.final_score !== a.final_score) {
      return b.final_score - a.final_score;
    }
    if (b.nilai_rapor !== a.nilai_rapor) {
      return b.nilai_rapor - a.nilai_rapor;
    }
    if (b.nilai_rata_rata_rapor !== a.nilai_rata_rata_rapor) {
      return b.nilai_rata_rata_rapor - a.nilai_rata_rata_rapor;
    }
    return a.id_student - b.id_student;
  }

  private async getQuotasMap(): Promise<Record<Jurusan, number>> {
    const dbQuotas = await this.prisma.major_quotas.findMany();
    const quotas: Record<Jurusan, number> = { ...DEFAULT_QUOTAS };
    for (const q of dbQuotas) {
      quotas[q.jurusan] = q.quota;
    }
    return quotas;
  }

  /**
   * Menjalankan proses seleksi dua tahap (Pilihan 1 -> Pilihan 2) secara manual oleh Admin.
   * Rumus nilai akhir dipertahankan: (raporAverage * 0.4) + (testAverage * 0.6).
   */
  async runSelectionProcess() {
    if (this.isSelectionRunning) {
      throw new ConflictException(
        'Proses seleksi sedang berlangsung. Mohon tunggu hingga selesai.',
      );
    }

    this.isSelectionRunning = true;
    try {
      // 1. Ambil seluruh siswa yang memenuhi syarat (memiliki nilai rapor & ujian lengkap, dan tidak DITOLAK)
      const [students, quotasMap] = await Promise.all([
        this.prisma.students.findMany({
          where: {
            verification_status: { not: VerificationStatus.DITOLAK },
            raporScores: { some: {} },
            nilaiScore: { isNot: null },
          },
          include: {
            raporScores: true,
            nilaiScore: true,
          },
        }),
        this.getQuotasMap(),
      ]);

      const candidates: SelectionCandidate[] = [];
      for (const student of students) {
        const rapor = student.raporScores[0];
        const test = student.nilaiScore;
        if (!rapor || !test) continue;

        const raporAverage = rapor.rata_rata || 0;
        const raporFinal = rapor.nilai_akhir || 0;
        const testAverage = test.average_score || 0;

        // Pertahankan rumus nilai akhir yang sudah ada: (rapor_average * 0.4) + (test_average * 0.6)
        const finalScore = Number(
          (raporAverage * 0.4 + testAverage * 0.6).toFixed(4),
        );

        const pilihan1 = student.jurusan_pilihan_1 ?? student.jurusan;
        const rawPilihan2 = student.jurusan_pilihan_2 ?? null;
        const pilihan2 =
          rawPilihan2 && rawPilihan2 !== pilihan1 ? rawPilihan2 : null;

        candidates.push({
          id_student: student.id,
          no_daftar: student.no_daftar,
          nama: student.nama,
          jurusan_pilihan_1: pilihan1,
          jurusan_pilihan_2: pilihan2,
          final_score: finalScore,
          nilai_rapor: raporFinal,
          nilai_rata_rata_rapor: raporAverage,
          nilai_ujian: testAverage,
        });
      }

      // Track kuota & hasil seleksi
      const acceptedStudentIds = new Set<number>();
      const acceptedCountStage1: Record<Jurusan, number> = {
        [Jurusan.AK]: 0,
        [Jurusan.ATP]: 0,
        [Jurusan.DKV]: 0,
        [Jurusan.TKJ]: 0,
        [Jurusan.TKR]: 0,
      };
      const acceptedCountStage2: Record<Jurusan, number> = {
        [Jurusan.AK]: 0,
        [Jurusan.ATP]: 0,
        [Jurusan.DKV]: 0,
        [Jurusan.TKJ]: 0,
        [Jurusan.TKR]: 0,
      };

      const stage1RankByStudent = new Map<number, number>();
      const stage2Candidates: SelectionCandidate[] = [];
      const finalResultsMap = new Map<number, SelectionResultRow>();

      // =====================================================================
      // TAHAP 1: Seleksi berdasarkan Jurusan Pilihan 1
      // =====================================================================
      const stage1Groups = new Map<Jurusan, SelectionCandidate[]>();
      for (const major of ALL_MAJORS) {
        stage1Groups.set(major, []);
      }

      for (const candidate of candidates) {
        stage1Groups.get(candidate.jurusan_pilihan_1)!.push(candidate);
      }

      for (const [major, group] of stage1Groups.entries()) {
        group.sort((a, b) => this.compareCandidates(a, b));
        const quota = Math.max(0, quotasMap[major] ?? 0);

        group.forEach((candidate, index) => {
          const rank = index + 1;
          stage1RankByStudent.set(candidate.id_student, rank);

          if (rank <= quota && !acceptedStudentIds.has(candidate.id_student)) {
            acceptedStudentIds.add(candidate.id_student);
            acceptedCountStage1[major] += 1;

            finalResultsMap.set(candidate.id_student, {
              id_student: candidate.id_student,
              final_score: candidate.final_score,
              nilai_rapor: candidate.nilai_rapor,
              nilai_rata_rata_rapor: candidate.nilai_rata_rata_rapor,
              nilai_ujian: candidate.nilai_ujian,
              ranking: rank,
              jurusan: major,
              jurusan_pilihan_1: candidate.jurusan_pilihan_1,
              jurusan_pilihan_2: candidate.jurusan_pilihan_2,
              jurusan_diterima: major,
              jalur_penerimaan: JalurPenerimaan.PILIHAN_1,
              status_akhir: StatusAkhirSeleksi.DITERIMA,
            });
          } else if (candidate.jurusan_pilihan_2 !== null) {
            // Tidak lolos Pilihan 1 dan memiliki Pilihan 2 -> masuk kandidat Tahap 2
            stage2Candidates.push(candidate);
          } else {
            // Tidak lolos Pilihan 1 dan tidak mengisi Pilihan 2 -> TIDAK DITERIMA
            finalResultsMap.set(candidate.id_student, {
              id_student: candidate.id_student,
              final_score: candidate.final_score,
              nilai_rapor: candidate.nilai_rapor,
              nilai_rata_rata_rapor: candidate.nilai_rata_rata_rapor,
              nilai_ujian: candidate.nilai_ujian,
              ranking: rank,
              jurusan: candidate.jurusan_pilihan_1,
              jurusan_pilihan_1: candidate.jurusan_pilihan_1,
              jurusan_pilihan_2: null,
              jurusan_diterima: null,
              jalur_penerimaan: null,
              status_akhir: StatusAkhirSeleksi.TIDAK_DITERIMA,
            });
          }
        });
      }

      // =====================================================================
      // TAHAP 2: Seleksi berdasarkan Jurusan Pilihan 2 (Sisa Kuota)
      // =====================================================================
      const stage2Groups = new Map<Jurusan, SelectionCandidate[]>();
      for (const major of ALL_MAJORS) {
        stage2Groups.set(major, []);
      }

      for (const candidate of stage2Candidates) {
        if (
          candidate.jurusan_pilihan_2 &&
          !acceptedStudentIds.has(candidate.id_student)
        ) {
          stage2Groups.get(candidate.jurusan_pilihan_2)!.push(candidate);
        }
      }

      for (const [major, group] of stage2Groups.entries()) {
        // Semua kandidat Pilihan 2 bersaing dalam satu ranking tanpa membedakan asal Pilihan 1
        group.sort((a, b) => this.compareCandidates(a, b));

        const totalQuota = Math.max(0, quotasMap[major] ?? 0);
        const remainingQuota = Math.max(
          0,
          totalQuota - acceptedCountStage1[major],
        );

        group.forEach((candidate, index) => {
          const stage2Rank = index + 1;
          const stage1Rank =
            stage1RankByStudent.get(candidate.id_student) ?? stage2Rank;

          if (
            remainingQuota > 0 &&
            stage2Rank <= remainingQuota &&
            !acceptedStudentIds.has(candidate.id_student)
          ) {
            acceptedStudentIds.add(candidate.id_student);
            acceptedCountStage2[major] += 1;

            finalResultsMap.set(candidate.id_student, {
              id_student: candidate.id_student,
              final_score: candidate.final_score,
              nilai_rapor: candidate.nilai_rapor,
              nilai_rata_rata_rapor: candidate.nilai_rata_rata_rapor,
              nilai_ujian: candidate.nilai_ujian,
              ranking: acceptedCountStage1[major] + stage2Rank,
              jurusan: major,
              jurusan_pilihan_1: candidate.jurusan_pilihan_1,
              jurusan_pilihan_2: candidate.jurusan_pilihan_2,
              jurusan_diterima: major,
              jalur_penerimaan: JalurPenerimaan.PILIHAN_2,
              status_akhir: StatusAkhirSeleksi.DITERIMA,
            });
          } else {
            finalResultsMap.set(candidate.id_student, {
              id_student: candidate.id_student,
              final_score: candidate.final_score,
              nilai_rapor: candidate.nilai_rapor,
              nilai_rata_rata_rapor: candidate.nilai_rata_rata_rapor,
              nilai_ujian: candidate.nilai_ujian,
              ranking: stage1Rank,
              jurusan: candidate.jurusan_pilihan_1,
              jurusan_pilihan_1: candidate.jurusan_pilihan_1,
              jurusan_pilihan_2: candidate.jurusan_pilihan_2,
              jurusan_diterima: null,
              jalur_penerimaan: null,
              status_akhir: StatusAkhirSeleksi.TIDAK_DITERIMA,
            });
          }
        });
      }

      const allFinalResults = Array.from(finalResultsMap.values());

      // 3. Simpan seluruh hasil seleksi & sinkronkan status pengumuman dalam 1 Prisma Transaction
      await this.prisma.$transaction(async (tx) => {
        await tx.student_ranking.deleteMany({});
        await tx.student_announcements.deleteMany({});

        if (allFinalResults.length > 0) {
          await tx.student_ranking.createMany({
            data: allFinalResults,
          });

          await tx.student_announcements.createMany({
            data: allFinalResults.map((res) => ({
              id_student: res.id_student,
              status:
                res.status_akhir === StatusAkhirSeleksi.DITERIMA
                  ? StudentAnnouncementStatus.PASSED
                  : StudentAnnouncementStatus.FAILED,
              jurusan_diterima: res.jurusan_diterima,
              jalur_penerimaan: res.jalur_penerimaan,
              is_published: false,
            })),
          });
        }
      });

      const summary = await this.buildSelectionSummary(quotasMap, allFinalResults);

      return {
        success: true,
        message: 'Proses seleksi penerimaan berhasil dijalankan',
        data: {
          total_processed: allFinalResults.length,
          summary,
        },
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      console.error('Error runSelectionProcess:', error);
      throw new InternalServerErrorException(
        'Gagal menjalankan proses seleksi penerimaan',
      );
    } finally {
      this.isSelectionRunning = false;
    }
  }

  /**
   * Alias agar endpoint /rankings/generate tetap berjalan dan menggunakan mekanisme seleksi 2 tahap.
   */
  async generateRanking() {
    return this.runSelectionProcess();
  }

  private async buildSelectionSummary(
    quotasMap: Record<Jurusan, number>,
    rows: Array<{
      jurusan_diterima: Jurusan | null;
      jalur_penerimaan: JalurPenerimaan | null;
      status_akhir: StatusAkhirSeleksi;
    }>,
  ) {
    let totalDiterimaPilihan1 = 0;
    let totalDiterimaPilihan2 = 0;
    let totalTidakDiterima = 0;

    const perMajorMap: Record<Jurusan, MajorQuotaSummary> = {
      [Jurusan.AK]: {
        jurusan: Jurusan.AK,
        kuota_total: quotasMap[Jurusan.AK] ?? 0,
        diterima_pilihan_1: 0,
        diterima_pilihan_2: 0,
        kuota_terisi: 0,
        sisa_kuota: quotasMap[Jurusan.AK] ?? 0,
      },
      [Jurusan.ATP]: {
        jurusan: Jurusan.ATP,
        kuota_total: quotasMap[Jurusan.ATP] ?? 0,
        diterima_pilihan_1: 0,
        diterima_pilihan_2: 0,
        kuota_terisi: 0,
        sisa_kuota: quotasMap[Jurusan.ATP] ?? 0,
      },
      [Jurusan.DKV]: {
        jurusan: Jurusan.DKV,
        kuota_total: quotasMap[Jurusan.DKV] ?? 0,
        diterima_pilihan_1: 0,
        diterima_pilihan_2: 0,
        kuota_terisi: 0,
        sisa_kuota: quotasMap[Jurusan.DKV] ?? 0,
      },
      [Jurusan.TKJ]: {
        jurusan: Jurusan.TKJ,
        kuota_total: quotasMap[Jurusan.TKJ] ?? 0,
        diterima_pilihan_1: 0,
        diterima_pilihan_2: 0,
        kuota_terisi: 0,
        sisa_kuota: quotasMap[Jurusan.TKJ] ?? 0,
      },
      [Jurusan.TKR]: {
        jurusan: Jurusan.TKR,
        kuota_total: quotasMap[Jurusan.TKR] ?? 0,
        diterima_pilihan_1: 0,
        diterima_pilihan_2: 0,
        kuota_terisi: 0,
        sisa_kuota: quotasMap[Jurusan.TKR] ?? 0,
      },
    };

    for (const row of rows) {
      if (row.status_akhir === StatusAkhirSeleksi.DITERIMA && row.jurusan_diterima) {
        const summary = perMajorMap[row.jurusan_diterima];
        if (row.jalur_penerimaan === JalurPenerimaan.PILIHAN_1) {
          totalDiterimaPilihan1 += 1;
          summary.diterima_pilihan_1 += 1;
        } else if (row.jalur_penerimaan === JalurPenerimaan.PILIHAN_2) {
          totalDiterimaPilihan2 += 1;
          summary.diterima_pilihan_2 += 1;
        }
        summary.kuota_terisi += 1;
        summary.sisa_kuota = Math.max(0, summary.kuota_total - summary.kuota_terisi);
      } else {
        totalTidakDiterima += 1;
      }
    }

    return {
      total_peserta_seleksi: rows.length,
      total_diterima_pilihan_1: totalDiterimaPilihan1,
      total_diterima_pilihan_2: totalDiterimaPilihan2,
      total_diterima: totalDiterimaPilihan1 + totalDiterimaPilihan2,
      total_tidak_diterima: totalTidakDiterima,
      kuota_per_jurusan: ALL_MAJORS.map((m) => perMajorMap[m]),
    };
  }

  /**
   * Mengambil hasil seleksi & ringkasan kuota dengan filter jurusan, jalur_penerimaan, dan status_akhir.
   */
  async getSelectionResults(query: QueryRankingDto) {
    try {
      const {
        page = 1,
        limit = 10,
        jurusan,
        jalur_penerimaan,
        status_akhir,
      } = query;
      const skip = (page - 1) * limit;

      const where: Prisma.student_rankingWhereInput = {};

      if (jurusan) {
        where.OR = [
          { jurusan_diterima: jurusan },
          { jurusan_pilihan_1: jurusan },
          { jurusan_pilihan_2: jurusan },
          { jurusan },
        ];
      }

      if (jalur_penerimaan) {
        where.jalur_penerimaan = jalur_penerimaan;
      }

      if (status_akhir) {
        where.status_akhir = status_akhir;
      }

      const [total, data, allRows, quotasMap] = await Promise.all([
        this.prisma.student_ranking.count({ where }),
        this.prisma.student_ranking.findMany({
          where,
          skip,
          take: limit,
          orderBy: [
            { status_akhir: 'asc' },
            { ranking: 'asc' },
            { final_score: 'desc' },
          ],
          include: {
            student: {
              select: {
                id: true,
                nama: true,
                no_daftar: true,
                nisn: true,
                asal_sekolah: true,
                jurusan: true,
                jurusan_pilihan_1: true,
                jurusan_pilihan_2: true,
              },
            },
          },
        }),
        this.prisma.student_ranking.findMany({
          select: {
            jurusan_diterima: true,
            jalur_penerimaan: true,
            status_akhir: true,
          },
        }),
        this.getQuotasMap(),
      ]);

      const summary = await this.buildSelectionSummary(quotasMap, allRows);

      return {
        success: true,
        message: 'Berhasil mengambil data hasil seleksi',
        metadata: {
          statusCode: HttpStatus.OK,
          total,
          page,
          limit,
          total_pages: Math.ceil(total / limit),
        },
        summary,
        data: data.map((item) => ({
          id: item.id,
          id_student: item.id_student,
          nama: item.student.nama,
          no_daftar: item.student.no_daftar,
          asal_sekolah: item.student.asal_sekolah,
          jurusan: item.jurusan,
          jurusan_pilihan_1:
            item.jurusan_pilihan_1 ??
            item.student.jurusan_pilihan_1 ??
            item.student.jurusan,
          jurusan_pilihan_2:
            item.jurusan_pilihan_2 ?? item.student.jurusan_pilihan_2 ?? null,
          jurusan_diterima: item.jurusan_diterima,
          jalur_penerimaan: item.jalur_penerimaan,
          status_akhir: item.status_akhir,
          final_score: item.final_score,
          nilai_rapor: item.nilai_rapor,
          nilai_rata_rata_rapor: item.nilai_rata_rata_rapor,
          nilai_ujian: item.nilai_ujian,
          ranking: item.ranking,
        })),
      };
    } catch (error) {
      console.error('Error getSelectionResults:', error);
      throw new InternalServerErrorException(
        'Gagal mengambil data hasil seleksi',
      );
    }
  }

  async getRankings(query: QueryRankingDto) {
    return this.getSelectionResults(query);
  }
}
