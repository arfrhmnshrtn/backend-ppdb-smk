import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { RankingsService, SelectionResultRow } from './rankings.service';
import {
  JalurPenerimaan,
  Jurusan,
  StatusAkhirSeleksi,
  VerificationStatus,
} from '../../generated/prisma/client';

jest.mock('../lib/prisma.service', () => ({
  PrismaService: {},
}));

interface MockStudent {
  id: number;
  no_daftar: string;
  nama: string;
  jurusan: Jurusan;
  jurusan_pilihan_1: Jurusan;
  jurusan_pilihan_2: Jurusan | null;
  verification_status: VerificationStatus;
  raporScores: Array<{ rata_rata: number; nilai_akhir: number }>;
  nilaiScore: { average_score: number } | null;
}

describe('RankingsService – Seleksi Dua Pilihan Jurusan (2 Tahap)', () => {
  let service: RankingsService;

  const studentsStore: MockStudent[] = [];
  const quotasStore = new Map<Jurusan, number>();
  let savedRankings: SelectionResultRow[] = [];
  let savedAnnouncements: Array<{
    id_student: number;
    status: string;
    jurusan_diterima: Jurusan | null;
    jalur_penerimaan: JalurPenerimaan | null;
  }> = [];
  let simulateTransactionError = false;

  const mockPrisma = {
    students: {
      findMany: jest.fn(async () =>
        studentsStore.filter(
          (s) =>
            s.verification_status !== VerificationStatus.DITOLAK &&
            s.raporScores.length > 0 &&
            s.nilaiScore !== null,
        ),
      ),
    },
    major_quotas: {
      findMany: jest.fn(async () =>
        Array.from(quotasStore.entries()).map(([jurusan, quota]) => ({
          jurusan,
          quota,
        })),
      ),
    },
    student_ranking: {
      deleteMany: jest.fn(async () => {
        savedRankings = [];
        return { count: 0 };
      }),
      createMany: jest.fn(
        async ({ data }: { data: SelectionResultRow[] }) => {
          if (simulateTransactionError) {
            throw new Error('Simulated DB transaction failure');
          }
          savedRankings = [...data];
          return { count: data.length };
        },
      ),
      findMany: jest.fn(async () => savedRankings),
      count: jest.fn(async () => savedRankings.length),
    },
    student_announcements: {
      deleteMany: jest.fn(async () => {
        savedAnnouncements = [];
        return { count: 0 };
      }),
      createMany: jest.fn(
        async ({
          data,
        }: {
          data: Array<{
            id_student: number;
            status: string;
            jurusan_diterima: Jurusan | null;
            jalur_penerimaan: JalurPenerimaan | null;
          }>;
        }) => {
          savedAnnouncements = [...data];
          return { count: data.length };
        },
      ),
    },
    $transaction: jest.fn(
      async <T>(
        callback: (tx: unknown) => Promise<T>,
      ): Promise<T> => {
        const snapshotRankings = [...savedRankings];
        const snapshotAnnouncements = [...savedAnnouncements];
        try {
          return await callback(mockPrisma);
        } catch (err) {
          // Rollback simulation
          savedRankings = snapshotRankings;
          savedAnnouncements = snapshotAnnouncements;
          throw err;
        }
      },
    ),
  };

  function addStudent(
    id: number,
    pilihan1: Jurusan,
    pilihan2: Jurusan | null,
    raporAvg: number,
    testAvg: number,
    raporFinal?: number,
    completeScores = true,
  ) {
    studentsStore.push({
      id,
      no_daftar: `SPMB-${String(id).padStart(4, '0')}`,
      nama: `Siswa ${id}`,
      jurusan: pilihan1,
      jurusan_pilihan_1: pilihan1,
      jurusan_pilihan_2: pilihan2,
      verification_status: VerificationStatus.TERVERIFIKASI,
      raporScores: completeScores
        ? [{ rata_rata: raporAvg, nilai_akhir: raporFinal ?? raporAvg }]
        : [],
      nilaiScore: completeScores ? { average_score: testAvg } : null,
    });
  }

  beforeEach(async () => {
    studentsStore.length = 0;
    quotasStore.clear();
    savedRankings = [];
    savedAnnouncements = [];
    simulateTransactionError = false;
    jest.clearAllMocks();

    quotasStore.set(Jurusan.TKJ, 2);
    quotasStore.set(Jurusan.TKR, 2);
    quotasStore.set(Jurusan.AK, 2);
    quotasStore.set(Jurusan.ATP, 2);
    quotasStore.set(Jurusan.DKV, 2);

    const module: TestingModule = await Test.createTestingModule({
      providers: [RankingsService],
    }).compile();

    service = module.get<RankingsService>(RankingsService);
    Object.defineProperty(service, 'prisma', { value: mockPrisma });
  });

  it('1, 2, 3, 4, 5, 6, 7, 15. Seleksi 2 tahap: lolos Pilihan 1, lolos Pilihan 2 dengan sisa kuota, penuh di Pilihan 2, tanpa Pilihan 2, dan tidak ada penerimaan ganda', async () => {
    // Kuota: TKJ = 2, AK = 2 (1 terisi Pilihan 1 -> sisa 1), TKR = 1 (penuh di Pilihan 1)
    quotasStore.set(Jurusan.TKJ, 2);
    quotasStore.set(Jurusan.AK, 2);
    quotasStore.set(Jurusan.TKR, 1);

    // Siswa 1: TKJ / AK -> Nilai akhir: 95 -> Lolos Pilihan 1 TKJ (#1)
    addStudent(1, Jurusan.TKJ, Jurusan.AK, 95, 95);
    // Siswa 2: TKJ / AK -> Nilai akhir: 90 -> Lolos Pilihan 1 TKJ (#2)
    addStudent(2, Jurusan.TKJ, Jurusan.AK, 90, 90);
    // Siswa 3: TKJ / AK -> Nilai akhir: 88 -> Gagal Pilihan 1 TKJ, masuk Pilihan 2 AK
    addStudent(3, Jurusan.TKJ, Jurusan.AK, 88, 88);
    // Siswa 4: DKV / AK -> Nilai akhir: 92 -> Gagal Pilihan 1 DKV (jika DKV kuota 1 dan ada Siswa 7 = 96), bersaing di Pilihan 2 AK
    quotasStore.set(Jurusan.DKV, 1);
    addStudent(7, Jurusan.DKV, null, 96, 96); // Lolos Pilihan 1 DKV (#1)
    addStudent(4, Jurusan.DKV, Jurusan.AK, 92, 92); // Gagal Pilihan 1 DKV, bersaing di Pilihan 2 AK (92 > 88 milik Siswa 3!)
    // Siswa 5: AK / TKR -> Nilai akhir: 94 -> Lolos Pilihan 1 AK (#1, sisa kuota AK = 1)
    addStudent(5, Jurusan.AK, Jurusan.TKR, 94, 94);
    // Siswa 6: TKR / null -> Nilai akhir: 85 -> Lolos Pilihan 1 TKR (#1, TKR penuh)
    addStudent(6, Jurusan.TKR, null, 85, 85);
    // Siswa 8: TKJ / TKR -> Nilai akhir: 82 -> Gagal Pilihan 1 TKJ, Pilihan 2 TKR sudah penuh (sisa 0) -> TIDAK DITERIMA
    addStudent(8, Jurusan.TKJ, Jurusan.TKR, 82, 82);
    // Siswa 9: TKJ / null -> Nilai akhir: 80 -> Hanya isi Pilihan 1 dan gagal -> TIDAK DITERIMA
    addStudent(9, Jurusan.TKJ, null, 80, 80);

    const res = await service.runSelectionProcess();
    expect(res.success).toBe(true);
    expect(res.data.total_processed).toBe(9);

    const byId = new Map(savedRankings.map((r) => [r.id_student, r]));

    // Siswa 1 & 2 lolos Pilihan 1 TKJ (tidak diproses lagi di Tahap 2)
    expect(byId.get(1)?.status_akhir).toBe(StatusAkhirSeleksi.DITERIMA);
    expect(byId.get(1)?.jurusan_diterima).toBe(Jurusan.TKJ);
    expect(byId.get(1)?.jalur_penerimaan).toBe(JalurPenerimaan.PILIHAN_1);

    // Siswa 4 (92) mengalahkan Siswa 3 (88) untuk 1 sisa kuota AK di Pilihan 2
    expect(byId.get(4)?.status_akhir).toBe(StatusAkhirSeleksi.DITERIMA);
    expect(byId.get(4)?.jurusan_diterima).toBe(Jurusan.AK);
    expect(byId.get(4)?.jalur_penerimaan).toBe(JalurPenerimaan.PILIHAN_2);

    // Siswa 3 kalah bersaing di Pilihan 2 AK -> TIDAK_DITERIMA
    expect(byId.get(3)?.status_akhir).toBe(StatusAkhirSeleksi.TIDAK_DITERIMA);
    expect(byId.get(3)?.jurusan_diterima).toBeNull();

    // Siswa 8 gagal karena TKR sudah penuh oleh Pilihan 1
    expect(byId.get(8)?.status_akhir).toBe(StatusAkhirSeleksi.TIDAK_DITERIMA);

    // Siswa 9 hanya isi Pilihan 1 dan gagal -> TIDAK_DITERIMA
    expect(byId.get(9)?.status_akhir).toBe(StatusAkhirSeleksi.TIDAK_DITERIMA);

    // Pastikan tidak ada duplikasi siswa (1 siswa = 1 baris hasil)
    expect(savedRankings).toHaveLength(9);
    expect(new Set(savedRankings.map((r) => r.id_student)).size).toBe(9);
  });

  it('8 & 9. Tie-breaking: nilai akhir sama -> nilai rapor tertinggi; jika masih sama -> rata-rata rapor tertinggi', async () => {
    quotasStore.set(Jurusan.TKJ, 1);

    // Siswa 10: raporAvg=80, testAvg=90 -> final = 80*0.4 + 90*0.6 = 32 + 54 = 86, raporFinal=85
    addStudent(10, Jurusan.TKJ, null, 80, 90, 85);
    // Siswa 11: raporAvg=80, testAvg=90 -> final = 86, raporFinal=88 (lebih tinggi!)
    addStudent(11, Jurusan.TKJ, null, 80, 90, 88);

    await service.runSelectionProcess();
    let byId = new Map(savedRankings.map((r) => [r.id_student, r]));
    expect(byId.get(11)?.status_akhir).toBe(StatusAkhirSeleksi.DITERIMA);
    expect(byId.get(10)?.status_akhir).toBe(StatusAkhirSeleksi.TIDAK_DITERIMA);

    // Uji jika nilai akhir sama DAN raporFinal sama, namun rata-rata rapor berbeda
    studentsStore.length = 0;
    // Siswa 12: raporAvg=86, testAvg=86 -> final=86, raporFinal=90
    // Siswa 13: raporAvg=89, testAvg=84 -> final=89*0.4 + 84*0.6 = 35.6 + 50.4 = 86, raporFinal=90
    addStudent(12, Jurusan.TKJ, null, 86, 86, 90);
    addStudent(13, Jurusan.TKJ, null, 89, 84, 90);

    await service.runSelectionProcess();
    byId = new Map(savedRankings.map((r) => [r.id_student, r]));
    expect(byId.get(13)?.status_akhir).toBe(StatusAkhirSeleksi.DITERIMA);
    expect(byId.get(12)?.status_akhir).toBe(StatusAkhirSeleksi.TIDAK_DITERIMA);
  });

  it('10 & 11. Jurusan tanpa pendaftar Pilihan 1 dan sisa kuota lebih besar dari jumlah kandidat Pilihan 2', async () => {
    quotasStore.set(Jurusan.TKJ, 1);
    quotasStore.set(Jurusan.ATP, 5); // Tidak ada pendaftar Pilihan 1 di ATP

    addStudent(1, Jurusan.TKJ, null, 95, 95); // Lolos TKJ
    addStudent(2, Jurusan.TKJ, Jurusan.ATP, 85, 85); // Gagal TKJ, pindah Pilihan 2 ATP (sisa kuota 5 > 1 kandidat)

    const res = await service.runSelectionProcess();
    const byId = new Map(savedRankings.map((r) => [r.id_student, r]));

    expect(byId.get(2)?.status_akhir).toBe(StatusAkhirSeleksi.DITERIMA);
    expect(byId.get(2)?.jurusan_diterima).toBe(Jurusan.ATP);
    expect(byId.get(2)?.jalur_penerimaan).toBe(JalurPenerimaan.PILIHAN_2);

    const atpQuota = res.data.summary.kuota_per_jurusan.find(
      (q) => q.jurusan === Jurusan.ATP,
    );
    expect(atpQuota?.diterima_pilihan_1).toBe(0);
    expect(atpQuota?.diterima_pilihan_2).toBe(1);
    expect(atpQuota?.sisa_kuota).toBe(4);
  });

  it('12 & 14. Seleksi dijalankan ulang menggunakan data terbaru dan mengabaikan pendaftar yang nilainya belum lengkap', async () => {
    quotasStore.set(Jurusan.TKJ, 1);
    addStudent(1, Jurusan.TKJ, null, 80, 80, 80, true);
    addStudent(2, Jurusan.TKJ, null, 99, 99, 99, false); // Nilai belum lengkap -> tidak ikut seleksi

    await service.runSelectionProcess();
    expect(savedRankings).toHaveLength(1);
    expect(savedRankings[0].id_student).toBe(1);

    // Lengkapi nilai Siswa 2 lalu jalankan ulang seleksi
    studentsStore[1].raporScores = [{ rata_rata: 99, nilai_akhir: 99 }];
    studentsStore[1].nilaiScore = { average_score: 99 };

    await service.runSelectionProcess();
    expect(savedRankings).toHaveLength(2);
    const byId = new Map(savedRankings.map((r) => [r.id_student, r]));
    expect(byId.get(2)?.status_akhir).toBe(StatusAkhirSeleksi.DITERIMA);
    expect(byId.get(1)?.status_akhir).toBe(StatusAkhirSeleksi.TIDAK_DITERIMA);
  });

  it('13. Jika proses seleksi gagal di tengah transaksi, hasil lama tidak terhapus sebagian (rollback)', async () => {
    quotasStore.set(Jurusan.TKJ, 1);
    addStudent(1, Jurusan.TKJ, null, 90, 90);
    await service.runSelectionProcess();
    expect(savedRankings).toHaveLength(1);

    // Simulasikan error di tengah transaksi pada run kedua
    addStudent(2, Jurusan.TKJ, null, 95, 95);
    simulateTransactionError = true;

    await expect(service.runSelectionProcess()).rejects.toThrow(
      InternalServerErrorException,
    );

    // Hasil lama tetap aman (tidak hilang setengah jadi)
    expect(savedRankings).toHaveLength(1);
    expect(savedRankings[0].id_student).toBe(1);
  });
});
