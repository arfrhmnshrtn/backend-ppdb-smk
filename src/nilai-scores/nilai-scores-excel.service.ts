import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../lib/prisma.service';
import {
  Jurusan,
  StatusDocument,
  StudentAnnouncementStatus,
  VerificationStatus,
} from '../../generated/prisma/client';
import {
  ConfirmImportNilaiDto,
  ConfirmImportNilaiItemDto,
} from './dto/confirm-import-nilai.dto';

export interface ValidImportNilaiItem {
  row_number: number;
  student_id: number;
  no_daftar: string;
  nama: string;
  jurusan: Jurusan;
  math_score: number;
  indonesia_score: number;
  english_score: number;
  religion_score: number;
  average_score: number;
  is_update: boolean;
  previous_average_score: number | null;
}

export interface InvalidImportNilaiItem {
  row_number: number;
  no_daftar: string | null;
  nama: string | null;
  errors: string[];
  message: string;
}

export interface ImportNilaiPreviewSummary {
  total_rows_checked: number;
  valid_count: number;
  invalid_count: number;
  new_scores_count: number;
  updated_scores_count: number;
}

export interface ImportNilaiPreviewResult {
  summary: ImportNilaiPreviewSummary;
  valid_data: ValidImportNilaiItem[];
  invalid_data: InvalidImportNilaiItem[];
}

export interface ConfirmImportNilaiResult {
  total_imported: number;
  created_count: number;
  updated_count: number;
  items: Array<{
    student_id: number;
    no_daftar: string;
    nama: string;
    math_score: number;
    indonesia_score: number;
    english_score: number;
    religion_score: number;
    average_score: number;
    action: 'CREATED' | 'UPDATED';
  }>;
}

interface StudentWithRelations {
  id: number;
  no_daftar: string;
  nama: string;
  jurusan: Jurusan;
  verification_status: VerificationStatus;
  documents: Array<{ status: StatusDocument }>;
  nilaiScore: {
    id: string;
    average_score: number;
  } | null;
  studentAnnouncements: {
    status: StudentAnnouncementStatus;
  } | null;
}

const EXPECTED_HEADERS = [
  'Kode PPDB',
  'Nama Siswa',
  'Jurusan',
  'Matematika',
  'Bahasa Indonesia',
  'Bahasa Inggris',
  'Agama',
  'Rata-rata',
] as const;

const LEGACY_EXPECTED_HEADERS = [
  'Kode PPDB',
  'Nama Siswa',
  'Matematika',
  'Bahasa Indonesia',
  'Bahasa Inggris',
  'Agama',
  'Rata-rata',
] as const;

@Injectable()
export class NilaiScoresExcelService {
  private readonly prisma = PrismaService;
  private lastPreviewValidItems: ValidImportNilaiItem[] = [];

  /**
   * Mengecek apakah siswa memenuhi kriteria:
   * 1. Seluruh dokumen persyaratan sudah terverifikasi / approved.
   * 2. Belum dikeluarkan / ditolak dari proses pendaftaran.
   */
  private isStudentEligibleForExamScore(
    student: StudentWithRelations,
  ): { eligible: boolean; reason?: string } {
    if (
      student.verification_status === VerificationStatus.DITOLAK ||
      student.studentAnnouncements?.status === StudentAnnouncementStatus.FAILED
    ) {
      return {
        eligible: false,
        reason: 'Siswa telah ditolak atau dikeluarkan dari proses pendaftaran',
      };
    }

    const allDocsApproved =
      student.documents.length > 0 &&
      student.documents.every((doc) => doc.status === StatusDocument.APPROVED);

    if (
      student.verification_status !== VerificationStatus.TERVERIFIKASI &&
      !allDocsApproved
    ) {
      return {
        eligible: false,
        reason: 'Siswa belum menyelesaikan verifikasi dokumen',
      };
    }

    return { eligible: true };
  }

  /**
   * Mengekstrak nilai primitif dari sel ExcelJS (menangani formula, richText, dll.)
   */
  private extractCellValue(
    cellValue: ExcelJS.CellValue,
  ): string | number | null {
    if (cellValue === null || cellValue === undefined) {
      return null;
    }
    if (typeof cellValue === 'string') {
      const trimmed = cellValue.trim();
      return trimmed.length === 0 ? null : trimmed;
    }
    if (typeof cellValue === 'number') {
      return Number.isNaN(cellValue) ? null : cellValue;
    }
    if (typeof cellValue === 'object') {
      if ('result' in cellValue && cellValue.result !== undefined) {
        if (
          typeof cellValue.result === 'number' ||
          typeof cellValue.result === 'string'
        ) {
          return this.extractCellValue(cellValue.result);
        }
        return null;
      }
      if ('richText' in cellValue && Array.isArray(cellValue.richText)) {
        const joined = cellValue.richText.map((part) => part.text).join('').trim();
        return joined.length === 0 ? null : joined;
      }
      if ('text' in cellValue && typeof cellValue.text === 'string') {
        const trimmed = cellValue.text.trim();
        return trimmed.length === 0 ? null : trimmed;
      }
    }
    return String(cellValue).trim() || null;
  }

  /**
   * Memvalidasi nilai mata pelajaran (0 - 100, wajib diisi, berupa angka)
   */
  private validateSubjectScore(
    rawVal: string | number | null,
    subjectLabel: string,
  ): { value: number | null; error?: string } {
    if (rawVal === null || rawVal === '') {
      return {
        value: null,
        error: `Nilai ${subjectLabel} belum diisi`,
      };
    }

    const numericVal =
      typeof rawVal === 'number'
        ? rawVal
        : Number(String(rawVal).trim().replace(',', '.'));

    if (Number.isNaN(numericVal) || !Number.isFinite(numericVal)) {
      return {
        value: null,
        error: `Nilai ${subjectLabel} harus berupa angka antara 0 sampai 100`,
      };
    }

    if (numericVal < 0) {
      return {
        value: null,
        error: `Nilai ${subjectLabel} tidak boleh kurang dari 0`,
      };
    }

    if (numericVal > 100) {
      return {
        value: null,
        error: `Nilai ${subjectLabel} melebihi batas 100`,
      };
    }

    return { value: Math.round(numericVal) };
  }

  private normalizeJurusan(rawMajor?: string | Jurusan): Jurusan | undefined {
    if (!rawMajor) return undefined;
    const upper = String(rawMajor).trim().toUpperCase();
    const validMajors: string[] = [
      Jurusan.AK,
      Jurusan.ATP,
      Jurusan.DKV,
      Jurusan.TKJ,
      Jurusan.TKR,
    ];
    if (!validMajors.includes(upper)) {
      throw new BadRequestException(
        `Jurusan "${rawMajor}" tidak valid. Pilihan jurusan: ${validMajors.join(', ')}`,
      );
    }
    return upper as Jurusan;
  }

  /**
   * Menghasilkan file Template Excel (.xlsx) berisi daftar siswa yang telah terverifikasi
   * (dapat difilter per jurusan) beserta worksheet Petunjuk Pengisian.
   */
  async generateTemplateExcel(rawMajor?: string | Jurusan): Promise<Buffer> {
    const major = this.normalizeJurusan(rawMajor);

    const students = await this.prisma.students.findMany({
      where: {
        ...(major ? { jurusan: major } : {}),
        verification_status: {
          not: VerificationStatus.DITOLAK,
        },
      },
      include: {
        documents: {
          select: { status: true },
        },
        nilaiScore: {
          select: { id: true, average_score: true },
        },
        studentAnnouncements: {
          select: { status: true },
        },
      },
      orderBy: {
        no_daftar: 'asc',
      },
    });

    const eligibleStudents = students.filter(
      (student) => this.isStudentEligibleForExamScore(student).eligible,
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistem PPDB SMK';
    workbook.created = new Date();

    // =========================================================================
    // WORKSHEET 1: Data Nilai Ujian
    // =========================================================================
    const sheet = workbook.addWorksheet('Data Nilai Ujian', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    sheet.columns = [
      { header: 'Kode PPDB', key: 'no_daftar', width: 22 },
      { header: 'Nama Siswa', key: 'nama', width: 34 },
      { header: 'Jurusan', key: 'jurusan', width: 16 },
      { header: 'Matematika', key: 'math_score', width: 16 },
      { header: 'Bahasa Indonesia', key: 'indonesia_score', width: 20 },
      { header: 'Bahasa Inggris', key: 'english_score', width: 18 },
      { header: 'Agama', key: 'religion_score', width: 16 },
      { header: 'Rata-rata', key: 'average_score', width: 16 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A8A' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };
      cell.protection = { locked: true };
    });

    eligibleStudents.forEach((student, index) => {
      const rowNumber = index + 2;
      const row = sheet.addRow({
        no_daftar: student.no_daftar,
        nama: student.nama,
        jurusan: student.jurusan,
        math_score: null,
        indonesia_score: null,
        english_score: null,
        religion_score: null,
        average_score: {
          formula: `IF(COUNT(D${rowNumber}:G${rowNumber})=4,AVERAGE(D${rowNumber}:G${rowNumber}),"")`,
        },
      });

      row.height = 22;

      for (let colIdx = 1; colIdx <= 8; colIdx++) {
        const cell = row.getCell(colIdx);
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        };

        if (colIdx >= 1 && colIdx <= 3) {
          // Kolom identitas (Kode PPDB, Nama Siswa, Jurusan) dikunci
          cell.protection = { locked: true };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' },
          };
          cell.alignment = {
            vertical: 'middle',
            horizontal: colIdx === 2 ? 'left' : 'center',
          };
        } else if (colIdx >= 4 && colIdx <= 7) {
          // Kolom input nilai dibuka agar bisa diisi oleh admin
          cell.protection = { locked: false };
          cell.numFmt = '0';
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.dataValidation = {
            type: 'whole',
            operator: 'between',
            allowBlank: false,
            formulae: [0, 100],
            showErrorMessage: true,
            errorStyle: 'stop',
            errorTitle: 'Nilai Tidak Valid',
            error: 'Masukkan angka bulat antara 0 sampai 100',
          };
        } else if (colIdx === 8) {
          // Kolom rata-rata otomatis dikunci
          cell.protection = { locked: true };
          cell.numFmt = '0.00';
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF1F5F9' },
          };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
      }
    });

    await sheet.protect('', {
      selectLockedCells: true,
      selectUnlockedCells: true,
      formatCells: false,
      formatColumns: true,
      formatRows: false,
      insertRows: false,
      insertColumns: false,
      deleteRows: false,
      deleteColumns: false,
    });

    // =========================================================================
    // WORKSHEET 2: Petunjuk Pengisian
    // =========================================================================
    const guideSheet = workbook.addWorksheet('Petunjuk Pengisian');
    guideSheet.columns = [
      { header: 'No', key: 'no', width: 8 },
      { header: 'Panduan Pengisian Template Nilai Ujian PPDB', key: 'desc', width: 95 },
    ];

    const guideHeader = guideSheet.getRow(1);
    guideHeader.height = 26;
    guideHeader.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0F172A' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });

    const instructions = [
      'Gunakan worksheet "Data Nilai Ujian" untuk mengisi nilai ujian calon siswa.',
      'Kolom "Kode PPDB", "Nama Siswa", dan "Jurusan" adalah identitas resmi dari database dan telah diproteksi agar tidak diubah.',
      'Isi nilai mata pelajaran Matematika, Bahasa Indonesia, Bahasa Inggris, dan Agama dengan bilangan bulat antara 0 sampai 100.',
      'Seluruh 4 kolom nilai mata pelajaran wajib diisi (tidak boleh dikosongkan).',
      'Kolom "Rata-rata" dihitung otomatis menggunakan rumus: (Matematika + Bahasa Indonesia + Bahasa Inggris + Agama) / 4.',
      'Saat file diunggah, sistem backend akan memvalidasi ulang seluruh data dan menghitung ulang nilai Rata-rata secara resmi.',
      'Pastikan tidak ada Kode PPDB yang duplikat dan jangan mengubah struktur judul kolom (header) pada baris pertama.',
      'Simpan file tetap dalam format .xlsx sebelum diunggah ke halaman Import Nilai Ujian.',
    ];

    instructions.forEach((text, idx) => {
      const r = guideSheet.addRow({ no: idx + 1, desc: text });
      r.height = 22;
      r.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
      r.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
    });

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Membaca file Excel (.xlsx), memvalidasi struktur dan setiap baris data (termasuk kesesuaian jurusan jika dipilih),
   * serta mengembalikan hasil preview (valid_data & invalid_data) tanpa menyimpan ke database.
   */
  async parseAndPreviewExcel(
    fileBuffer: Buffer,
    originalFilename: string,
    rawMajor?: string | Jurusan,
  ): Promise<ImportNilaiPreviewResult> {
    const targetMajor = this.normalizeJurusan(rawMajor);

    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException('File Excel tidak boleh kosong');
    }

    if (!originalFilename.toLowerCase().endsWith('.xlsx')) {
      throw new BadRequestException(
        'Format file tidak valid. Harap unggah file dengan ekstensi .xlsx',
      );
    }

    // Validasi signature ZIP/XLSX (PK\x03\x04) untuk memastikan file benar-benar arsip .xlsx
    if (
      fileBuffer.length < 4 ||
      fileBuffer[0] !== 0x50 ||
      fileBuffer[1] !== 0x4b ||
      fileBuffer[2] !== 0x03 ||
      fileBuffer[3] !== 0x04
    ) {
      throw new BadRequestException(
        'File yang diunggah bukan file Excel (.xlsx) yang valid',
      );
    }

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(fileBuffer as unknown as ExcelJS.Buffer);
    } catch {
      throw new BadRequestException(
        'Gagal membaca file Excel. Pastikan file .xlsx tidak rusak (corrupt)',
      );
    }

    const sheet =
      workbook.getWorksheet('Data Nilai Ujian') || workbook.worksheets[0];

    if (!sheet) {
      throw new BadRequestException(
        'Worksheet tidak ditemukan di dalam file Excel',
      );
    }

    // Validasi struktur header pada baris 1 (mendukung format 8 kolom dengan Jurusan maupun 7 kolom)
    const headerRow = sheet.getRow(1);
    const actualHeaders8: string[] = [];
    for (let col = 1; col <= EXPECTED_HEADERS.length; col++) {
      const val = this.extractCellValue(headerRow.getCell(col).value);
      actualHeaders8.push(val !== null ? String(val).trim() : '');
    }

    const isHeaderWithJurusan = EXPECTED_HEADERS.every(
      (expected, idx) =>
        actualHeaders8[idx].toLowerCase() === expected.toLowerCase(),
    );

    const isLegacyHeader =
      !isHeaderWithJurusan &&
      LEGACY_EXPECTED_HEADERS.every(
        (expected, idx) =>
          actualHeaders8[idx].toLowerCase() === expected.toLowerCase(),
      );

    if (!isHeaderWithJurusan && !isLegacyHeader) {
      throw new BadRequestException(
        `Struktur kolom tidak sesuai dengan template. Header wajib: ${EXPECTED_HEADERS.join(', ')}`,
      );
    }

    // Kumpulkan seluruh baris yang tidak kosong (mulai dari baris ke-2)
    interface RawParsedRow {
      rowNumber: number;
      noDaftar: string | null;
      nama: string | null;
      jurusanRaw: string | null;
      mathRaw: string | number | null;
      indonesiaRaw: string | number | null;
      englishRaw: string | number | null;
      religionRaw: string | number | null;
    }

    const parsedRows: RawParsedRow[] = [];
    const codeOccurrences = new Map<string, number>();

    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;

      const noDaftarVal = this.extractCellValue(row.getCell(1).value);
      const namaVal = this.extractCellValue(row.getCell(2).value);
      const jurusanVal = isHeaderWithJurusan
        ? this.extractCellValue(row.getCell(3).value)
        : null;
      const mathRaw = this.extractCellValue(
        row.getCell(isHeaderWithJurusan ? 4 : 3).value,
      );
      const indonesiaRaw = this.extractCellValue(
        row.getCell(isHeaderWithJurusan ? 5 : 4).value,
      );
      const englishRaw = this.extractCellValue(
        row.getCell(isHeaderWithJurusan ? 6 : 5).value,
      );
      const religionRaw = this.extractCellValue(
        row.getCell(isHeaderWithJurusan ? 7 : 6).value,
      );

      // Abaikan baris yang benar-benar kosong
      if (
        noDaftarVal === null &&
        namaVal === null &&
        jurusanVal === null &&
        mathRaw === null &&
        indonesiaRaw === null &&
        englishRaw === null &&
        religionRaw === null
      ) {
        return;
      }

      const noDaftar = noDaftarVal !== null ? String(noDaftarVal).trim() : null;
      const nama = namaVal !== null ? String(namaVal).trim() : null;
      const jurusanRaw =
        jurusanVal !== null ? String(jurusanVal).trim().toUpperCase() : null;

      if (noDaftar) {
        const normalizedCode = noDaftar.toUpperCase();
        codeOccurrences.set(
          normalizedCode,
          (codeOccurrences.get(normalizedCode) ?? 0) + 1,
        );
      }

      parsedRows.push({
        rowNumber,
        noDaftar,
        nama,
        jurusanRaw,
        mathRaw,
        indonesiaRaw,
        englishRaw,
        religionRaw,
      });
    });

    if (parsedRows.length === 0) {
      throw new BadRequestException(
        'File Excel tidak memiliki data nilai siswa untuk diproses',
      );
    }

    // Ambil seluruh data siswa dari database untuk pencocokan
    const allStudents = await this.prisma.students.findMany({
      include: {
        documents: {
          select: { status: true },
        },
        nilaiScore: {
          select: { id: true, average_score: true },
        },
        studentAnnouncements: {
          select: { status: true },
        },
      },
    });

    const studentByCode = new Map<string, StudentWithRelations>();
    for (const s of allStudents) {
      studentByCode.set(s.no_daftar.trim().toUpperCase(), s);
    }

    const validData: ValidImportNilaiItem[] = [];
    const invalidData: InvalidImportNilaiItem[] = [];

    for (const row of parsedRows) {
      const errors: string[] = [];
      let matchedStudent: StudentWithRelations | undefined;

      if (!row.noDaftar) {
        errors.push('Kode PPDB belum diisi');
      } else {
        const normalizedCode = row.noDaftar.toUpperCase();
        if ((codeOccurrences.get(normalizedCode) ?? 0) > 1) {
          errors.push('Kode PPDB ditemukan lebih dari satu kali');
        }

        matchedStudent = studentByCode.get(normalizedCode);
        if (!matchedStudent) {
          errors.push('Kode PPDB tidak ditemukan');
        }
      }

      if (!row.nama) {
        errors.push('Nama siswa belum diisi');
      } else if (
        matchedStudent &&
        matchedStudent.nama.trim().toLowerCase() !== row.nama.toLowerCase()
      ) {
        errors.push('Nama siswa tidak sesuai dengan kode PPDB');
      }

      if (matchedStudent) {
        if (
          isHeaderWithJurusan &&
          row.jurusanRaw &&
          row.jurusanRaw !== matchedStudent.jurusan
        ) {
          errors.push(
            `Jurusan pada Excel (${row.jurusanRaw}) tidak sesuai dengan jurusan siswa (${matchedStudent.jurusan})`,
          );
        }

        if (targetMajor && matchedStudent.jurusan !== targetMajor) {
          errors.push(
            `Siswa terdaftar pada jurusan ${matchedStudent.jurusan}, tidak sesuai dengan jurusan yang dipilih (${targetMajor})`,
          );
        }

        const eligibility = this.isStudentEligibleForExamScore(matchedStudent);
        if (!eligibility.eligible && eligibility.reason) {
          errors.push(eligibility.reason);
        }
      }

      const mathCheck = this.validateSubjectScore(row.mathRaw, 'Matematika');
      if (mathCheck.error) errors.push(mathCheck.error);

      const indonesiaCheck = this.validateSubjectScore(
        row.indonesiaRaw,
        'Bahasa Indonesia',
      );
      if (indonesiaCheck.error) errors.push(indonesiaCheck.error);

      const englishCheck = this.validateSubjectScore(
        row.englishRaw,
        'Bahasa Inggris',
      );
      if (englishCheck.error) errors.push(englishCheck.error);

      const religionCheck = this.validateSubjectScore(row.religionRaw, 'Agama');
      if (religionCheck.error) errors.push(religionCheck.error);

      if (
        errors.length === 0 &&
        matchedStudent &&
        mathCheck.value !== null &&
        indonesiaCheck.value !== null &&
        englishCheck.value !== null &&
        religionCheck.value !== null
      ) {
        const averageScore = Number(
          (
            (mathCheck.value +
              indonesiaCheck.value +
              englishCheck.value +
              religionCheck.value) /
            4
          ).toFixed(2),
        );

        validData.push({
          row_number: row.rowNumber,
          student_id: matchedStudent.id,
          no_daftar: matchedStudent.no_daftar,
          nama: matchedStudent.nama,
          jurusan: matchedStudent.jurusan,
          math_score: mathCheck.value,
          indonesia_score: indonesiaCheck.value,
          english_score: englishCheck.value,
          religion_score: religionCheck.value,
          average_score: averageScore,
          is_update: matchedStudent.nilaiScore !== null,
          previous_average_score:
            matchedStudent.nilaiScore?.average_score ?? null,
        });
      } else {
        invalidData.push({
          row_number: row.rowNumber,
          no_daftar: row.noDaftar,
          nama: row.nama,
          errors,
          message: errors.join('; '),
        });
      }
    }

    const updatedScoresCount = validData.filter((d) => d.is_update).length;
    const newScoresCount = validData.length - updatedScoresCount;

    // Simpan cache validData dari preview terakhir agar konfirmasi tanpa payload tetap dapat diproses
    this.lastPreviewValidItems = validData;

    return {
      summary: {
        total_rows_checked: parsedRows.length,
        valid_count: validData.length,
        invalid_count: invalidData.length,
        new_scores_count: newScoresCount,
        updated_scores_count: updatedScoresCount,
      },
      valid_data: validData,
      invalid_data: invalidData,
    };
  }

  /**
   * Menyimpan atau memperbarui data nilai ujian yang telah lolos validasi ke database
   * menggunakan transaksi Prisma. TIDAK menjalankan perhitungan ranking otomatis.
   */
  async confirmImportNilai(
    dto?: ConfirmImportNilaiDto | ConfirmImportNilaiItemDto[],
    rawMajor?: string | Jurusan,
  ): Promise<ConfirmImportNilaiResult> {
    const dtoMajor =
      !Array.isArray(dto) && dto ? (dto.major ?? dto.jurusan) : undefined;
    const targetMajor = this.normalizeJurusan(rawMajor ?? dtoMajor);

    const rawItems = Array.isArray(dto)
      ? dto
      : (dto?.items ??
        dto?.valid_data ??
        dto?.validData ??
        dto?.data ??
        (this.lastPreviewValidItems.length > 0
          ? this.lastPreviewValidItems
          : []));

    if (!rawItems || rawItems.length === 0) {
      throw new BadRequestException(
        'Tidak ada data nilai valid untuk diimpor. Silakan unggah file Excel terlebih dahulu.',
      );
    }

    const items = rawItems;

    // 1. Cek duplikasi Kode PPDB pada payload konfirmasi
    const seenCodes = new Set<string>();
    for (const item of items) {
      const code = item.no_daftar.trim().toUpperCase();
      if (seenCodes.has(code)) {
        throw new BadRequestException(
          `Terdapat Kode PPDB duplikat pada data konfirmasi: ${item.no_daftar}`,
        );
      }
      seenCodes.add(code);
    }

    // 2. Ambil seluruh siswa terkait berdasarkan Kode PPDB
    const students = await this.prisma.students.findMany({
      where: {
        no_daftar: {
          in: items.map((i) => i.no_daftar.trim()),
        },
      },
      include: {
        documents: {
          select: { status: true },
        },
        nilaiScore: {
          select: { id: true, average_score: true },
        },
        studentAnnouncements: {
          select: { status: true },
        },
      },
    });

    const studentByCode = new Map<string, StudentWithRelations>();
    for (const s of students) {
      studentByCode.set(s.no_daftar.trim().toUpperCase(), s);
    }

    // 3. Validasi setiap item sebelum transaksi dijalankan
    const preparedOperations: Array<{
      student: StudentWithRelations;
      math_score: number;
      indonesia_score: number;
      english_score: number;
      religion_score: number;
      average_score: number;
      action: 'CREATED' | 'UPDATED';
    }> = [];

    for (const item of items) {
      const code = item.no_daftar.trim().toUpperCase();
      const student = studentByCode.get(code);

      if (!student) {
        throw new BadRequestException(
          `Kode PPDB ${item.no_daftar} tidak ditemukan di database`,
        );
      }

      if (
        item.nama &&
        student.nama.trim().toLowerCase() !== item.nama.trim().toLowerCase()
      ) {
        throw new BadRequestException(
          `Nama siswa (${item.nama}) tidak sesuai dengan Kode PPDB ${item.no_daftar}`,
        );
      }

      if (targetMajor && student.jurusan !== targetMajor) {
        throw new BadRequestException(
          `Siswa dengan Kode PPDB ${item.no_daftar} terdaftar di jurusan ${student.jurusan}, bukan jurusan ${targetMajor}`,
        );
      }

      const eligibility = this.isStudentEligibleForExamScore(student);
      if (!eligibility.eligible) {
        throw new BadRequestException(
          `Siswa dengan Kode PPDB ${item.no_daftar} tidak memenuhi syarat: ${eligibility.reason}`,
        );
      }

      const mathInt = Math.round(item.math_score);
      const indonesiaInt = Math.round(item.indonesia_score);
      const englishInt = Math.round(item.english_score);
      const religionInt = Math.round(item.religion_score);

      // Hitung ulang rata-rata di backend: (Matematika + B.Indonesia + B.Inggris + Agama) / 4
      const averageScore = Number(
        ((mathInt + indonesiaInt + englishInt + religionInt) / 4).toFixed(2),
      );

      preparedOperations.push({
        student,
        math_score: mathInt,
        indonesia_score: indonesiaInt,
        english_score: englishInt,
        religion_score: religionInt,
        average_score: averageScore,
        action: student.nilaiScore ? 'UPDATED' : 'CREATED',
      });
    }

    // 4. Simpan ke database secara atomic menggunakan transaksi Prisma (upsert per student_id)
    await this.prisma.$transaction(
      preparedOperations.map((op) =>
        this.prisma.nilai_scores.upsert({
          where: { student_id: op.student.id },
          create: {
            student_id: op.student.id,
            math_score: op.math_score,
            indonesia_score: op.indonesia_score,
            english_score: op.english_score,
            religion_score: op.religion_score,
            average_score: op.average_score,
          },
          update: {
            math_score: op.math_score,
            indonesia_score: op.indonesia_score,
            english_score: op.english_score,
            religion_score: op.religion_score,
            average_score: op.average_score,
          },
        }),
      ),
    );

    const createdCount = preparedOperations.filter(
      (op) => op.action === 'CREATED',
    ).length;
    const updatedCount = preparedOperations.filter(
      (op) => op.action === 'UPDATED',
    ).length;

    return {
      total_imported: preparedOperations.length,
      created_count: createdCount,
      updated_count: updatedCount,
      items: preparedOperations.map((op) => ({
        student_id: op.student.id,
        no_daftar: op.student.no_daftar,
        nama: op.student.nama,
        math_score: op.math_score,
        indonesia_score: op.indonesia_score,
        english_score: op.english_score,
        religion_score: op.religion_score,
        average_score: op.average_score,
        action: op.action,
      })),
    };
  }
}
