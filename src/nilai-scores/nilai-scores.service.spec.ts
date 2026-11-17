import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { NilaiScoresService } from './nilai-scores.service';
import { NilaiScoresExcelService } from './nilai-scores-excel.service';
import {
  Jurusan,
  StatusDocument,
  StudentAnnouncementStatus,
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
  verification_status: VerificationStatus;
  documents: Array<{ status: StatusDocument }>;
  nilaiScore: { id: string; average_score: number } | null;
  studentAnnouncements: { status: StudentAnnouncementStatus } | null;
}

describe('NilaiScoresExcelService & NilaiScoresService', () => {
  let service: NilaiScoresService;
  let excelService: NilaiScoresExcelService;

  const studentsStore = new Map<number, MockStudent>();
  const scoresStore = new Map<
    number,
    {
      id: string;
      student_id: number;
      math_score: number;
      indonesia_score: number;
      english_score: number;
      religion_score: number;
      average_score: number;
    }
  >();

  const mockPrisma = {
    students: {
      findMany: jest.fn(
        async (args?: { where?: { jurusan?: Jurusan } }) => {
          const all = Array.from(studentsStore.values());
          if (args?.where?.jurusan) {
            return all.filter((s) => s.jurusan === args.where?.jurusan);
          }
          return all;
        },
      ),
    },
    nilai_scores: {
      upsert: jest.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: { student_id: number };
          create: {
            student_id: number;
            math_score: number;
            indonesia_score: number;
            english_score: number;
            religion_score: number;
            average_score: number;
          };
          update: {
            math_score: number;
            indonesia_score: number;
            english_score: number;
            religion_score: number;
            average_score: number;
          };
        }) => {
          const existing = scoresStore.get(where.student_id);
          const record = existing
            ? { ...existing, ...update }
            : { id: `score-${where.student_id}`, ...create };
          scoresStore.set(where.student_id, record);
          const st = studentsStore.get(where.student_id);
          if (st) {
            studentsStore.set(where.student_id, {
              ...st,
              nilaiScore: { id: record.id, average_score: record.average_score },
            });
          }
          return record;
        },
      ),
    },
    $transaction: jest.fn(async (ops: Array<Promise<unknown>>) =>
      Promise.all(ops),
    ),
  };

  beforeEach(async () => {
    studentsStore.clear();
    scoresStore.clear();
    jest.clearAllMocks();

    // Siswa 1: Terverifikasi (belum punya nilai)
    studentsStore.set(1, {
      id: 1,
      no_daftar: 'SPMB-100001',
      nama: 'Ahmad Fauzan',
      jurusan: Jurusan.TKJ,
      verification_status: VerificationStatus.TERVERIFIKASI,
      documents: [{ status: StatusDocument.APPROVED }],
      nilaiScore: null,
      studentAnnouncements: null,
    });

    // Siswa 2: Terverifikasi (sudah punya nilai lama -> akan di-update)
    studentsStore.set(2, {
      id: 2,
      no_daftar: 'SPMB-100002',
      nama: 'Siti Aminah',
      jurusan: Jurusan.AK,
      verification_status: VerificationStatus.TERVERIFIKASI,
      documents: [{ status: StatusDocument.APPROVED }],
      nilaiScore: { id: 'score-2', average_score: 75 },
      studentAnnouncements: null,
    });
    scoresStore.set(2, {
      id: 'score-2',
      student_id: 2,
      math_score: 75,
      indonesia_score: 75,
      english_score: 75,
      religion_score: 75,
      average_score: 75,
    });

    // Siswa 3: Dokumen belum diverifikasi (REVISI)
    studentsStore.set(3, {
      id: 3,
      no_daftar: 'SPMB-100003',
      nama: 'Budi Hartono',
      jurusan: Jurusan.TKR,
      verification_status: VerificationStatus.REVISI,
      documents: [{ status: StatusDocument.REVISI }],
      nilaiScore: null,
      studentAnnouncements: null,
    });

    // Siswa 4: Ditolak (DITOLAK)
    studentsStore.set(4, {
      id: 4,
      no_daftar: 'SPMB-100004',
      nama: 'Doni Pratama',
      jurusan: Jurusan.DKV,
      verification_status: VerificationStatus.DITOLAK,
      documents: [{ status: StatusDocument.REJECTED }],
      nilaiScore: null,
      studentAnnouncements: null,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [NilaiScoresService, NilaiScoresExcelService],
    }).compile();

    service = module.get<NilaiScoresService>(NilaiScoresService);
    excelService = module.get<NilaiScoresExcelService>(NilaiScoresExcelService);
    Object.defineProperty(excelService, 'prisma', { value: mockPrisma });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(excelService).toBeDefined();
  });

  it('1. Download Template Excel hanya berisi siswa yang dokumennya sudah terverifikasi & memiliki sheet Petunjuk Pengisian', async () => {
    const buffer = await excelService.generateTemplateExcel();
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

    const dataSheet = workbook.getWorksheet('Data Nilai Ujian');
    const guideSheet = workbook.getWorksheet('Petunjuk Pengisian');

    expect(dataSheet).toBeDefined();
    expect(guideSheet).toBeDefined();

    // Baris 1 adalah header, Baris 2 dan 3 adalah Siswa 1 dan Siswa 2 (Siswa 3 & 4 tidak masuk)
    expect(dataSheet?.rowCount).toBe(3);
    expect(dataSheet?.getRow(1).getCell(3).value).toBe('Jurusan');
    expect(dataSheet?.getRow(2).getCell(1).value).toBe('SPMB-100001');
    expect(dataSheet?.getRow(2).getCell(2).value).toBe('Ahmad Fauzan');
    expect(dataSheet?.getRow(2).getCell(3).value).toBe('TKJ');
    expect(dataSheet?.getRow(3).getCell(1).value).toBe('SPMB-100002');
    expect(dataSheet?.getRow(3).getCell(2).value).toBe('Siti Aminah');
    expect(dataSheet?.getRow(3).getCell(3).value).toBe('AK');
  });

  it('2 & 3. Upload & Preview Excel memisahkan data valid dan data error secara spesifik serta menghitung ulang rata-rata di backend', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Data Nilai Ujian');
    sheet.addRow([
      'Kode PPDB',
      'Nama Siswa',
      'Jurusan',
      'Matematika',
      'Bahasa Indonesia',
      'Bahasa Inggris',
      'Agama',
      'Rata-rata',
    ]);

    // Baris 2: Valid (Siswa 1 - baru) -> rata-rata di Excel diisi salah (999), backend harus hitung ulang (80+90+85+95)/4 = 87.5
    sheet.addRow(['SPMB-100001', 'Ahmad Fauzan', 'TKJ', 80, 90, 85, 95, 999]);
    // Baris 3: Valid (Siswa 2 - update) -> (90+90+80+80)/4 = 85
    sheet.addRow(['SPMB-100002', 'Siti Aminah', 'AK', 90, 90, 80, 80, 85]);
    // Baris 4: Invalid - Kode PPDB tidak ditemukan
    sheet.addRow(['SPMB-999999', 'Siswa Misterius', 'TKJ', 80, 80, 80, 80, 80]);
    // Baris 5: Invalid - Nama tidak sesuai & nilai Matematika > 100 & B.Indo kosong
    sheet.addRow([
      'SPMB-100003',
      'Nama Salah',
      'TKR',
      105,
      null,
      80,
      80,
      null,
    ]);

    const fileBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const preview = await excelService.parseAndPreviewExcel(
      fileBuffer,
      'nilai_ujian.xlsx',
    );

    expect(preview.summary.total_rows_checked).toBe(4);
    expect(preview.summary.valid_count).toBe(2);
    expect(preview.summary.invalid_count).toBe(2);
    expect(preview.summary.new_scores_count).toBe(1);
    expect(preview.summary.updated_scores_count).toBe(1);

    // Pastikan nilai rata-rata dihitung ulang di backend (87.5, bukan 999)
    expect(preview.valid_data[0].no_daftar).toBe('SPMB-100001');
    expect(preview.valid_data[0].average_score).toBe(87.5);
    expect(preview.valid_data[0].is_update).toBe(false);

    expect(preview.valid_data[1].no_daftar).toBe('SPMB-100002');
    expect(preview.valid_data[1].average_score).toBe(85);
    expect(preview.valid_data[1].is_update).toBe(true);

    // Pastikan pesan error spesifik pada invalid_data
    expect(preview.invalid_data[0].row_number).toBe(4);
    expect(preview.invalid_data[0].errors).toContain(
      'Kode PPDB tidak ditemukan',
    );

    expect(preview.invalid_data[1].row_number).toBe(5);
    expect(preview.invalid_data[1].errors).toContain(
      'Nama siswa tidak sesuai dengan kode PPDB',
    );
    expect(preview.invalid_data[1].errors).toContain(
      'Siswa belum menyelesaikan verifikasi dokumen',
    );
    expect(preview.invalid_data[1].errors).toContain(
      'Nilai Matematika melebihi batas 100',
    );
    expect(preview.invalid_data[1].errors).toContain(
      'Nilai Bahasa Indonesia belum diisi',
    );
  });

  it('4. Menolak file jika header tidak sesuai dengan template', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sheet1');
    sheet.addRow(['ID', 'Nama', 'MTK']);
    sheet.addRow(['SPMB-100001', 'Ahmad Fauzan', 90]);

    const fileBuffer = Buffer.from(await workbook.xlsx.writeBuffer());

    await expect(
      excelService.parseAndPreviewExcel(fileBuffer, 'wrong_header.xlsx'),
    ).rejects.toThrow(BadRequestException);
  });

  it('5. Konfirmasi Import menyimpan nilai baru dan memperbarui nilai lama dalam transaksi Prisma tanpa duplikasi', async () => {
    const result = await excelService.confirmImportNilai({
      items: [
        {
          no_daftar: 'SPMB-100001',
          nama: 'Ahmad Fauzan',
          math_score: 80,
          indonesia_score: 90,
          english_score: 85,
          religion_score: 95,
        },
        {
          no_daftar: 'SPMB-100002',
          nama: 'Siti Aminah',
          math_score: 90,
          indonesia_score: 90,
          english_score: 80,
          religion_score: 80,
        },
      ],
    });

    expect(result.total_imported).toBe(2);
    expect(result.created_count).toBe(1);
    expect(result.updated_count).toBe(1);

    // Pastikan tersimpan di store dan rata-rata akurat
    expect(scoresStore.get(1)?.average_score).toBe(87.5);
    expect(scoresStore.get(2)?.average_score).toBe(85);
    expect(scoresStore.size).toBe(2);
  });

  it('6. Download Template & Upload Preview per jurusan memfilter siswa sesuai jurusan yang dipilih', async () => {
    // Download template khusus jurusan TKJ -> hanya Siswa 1 (TKJ) yang masuk, Siswa 2 (AK) tidak masuk
    const tkjBuffer = await excelService.generateTemplateExcel(Jurusan.TKJ);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(tkjBuffer as unknown as ExcelJS.Buffer);
    const sheet = wb.getWorksheet('Data Nilai Ujian');
    expect(sheet?.rowCount).toBe(2); // 1 header + 1 siswa TKJ
    expect(sheet?.getRow(2).getCell(1).value).toBe('SPMB-100001');

    // Upload file berisi Siswa 1 (TKJ) dan Siswa 2 (AK) pada mode upload jurusan TKJ
    const uploadWb = new ExcelJS.Workbook();
    const uploadSheet = uploadWb.addWorksheet('Data Nilai Ujian');
    uploadSheet.addRow([
      'Kode PPDB',
      'Nama Siswa',
      'Matematika',
      'Bahasa Indonesia',
      'Bahasa Inggris',
      'Agama',
      'Rata-rata',
    ]);
    uploadSheet.addRow(['SPMB-100001', 'Ahmad Fauzan', 80, 80, 80, 80, 80]);
    uploadSheet.addRow(['SPMB-100002', 'Siti Aminah', 85, 85, 85, 85, 85]);

    const uploadBuf = Buffer.from(await uploadWb.xlsx.writeBuffer());
    const previewTkj = await excelService.parseAndPreviewExcel(
      uploadBuf,
      'nilai_tkj.xlsx',
      Jurusan.TKJ,
    );

    // Siswa 1 (TKJ) valid, Siswa 2 (AK) masuk invalid_data karena jurusannya berbeda
    expect(previewTkj.summary.valid_count).toBe(1);
    expect(previewTkj.summary.invalid_count).toBe(1);
    expect(previewTkj.valid_data[0].no_daftar).toBe('SPMB-100001');
    expect(previewTkj.invalid_data[0].no_daftar).toBe('SPMB-100002');
    expect(previewTkj.invalid_data[0].message).toContain(
      'Siswa terdaftar pada jurusan AK, tidak sesuai dengan jurusan yang dipilih (TKJ)',
    );
  });
});
