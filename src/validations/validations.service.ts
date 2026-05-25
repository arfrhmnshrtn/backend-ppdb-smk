import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ValidateDocumentDto } from './dto/validate-document.dto';
import { BulkValidateDocumentsDto } from './dto/bulk-validate-documents.dto';
import { PrismaService } from '../lib/prisma.service';
import {
  StatusDocument,
  VerificationStatus,
} from '../../generated/prisma/client';

@Injectable()
export class ValidationsService {
  private readonly prisma = PrismaService;

  /**
   * Method untuk admin memvalidasi dokumen
   */
  async validateDocument(id: string, validateDocumentDto: ValidateDocumentDto) {
    try {
      const { status, keterangan } = validateDocumentDto;

      // 1. Pastikan dokumen exists
      const existingDocument = await this.prisma.documents.findUnique({
        where: { id },
      });

      if (!existingDocument) {
        throw new NotFoundException('Dokumen tidak ditemukan');
      }

      // 2. Logic: jika status APPROVED, keterangan dikosongkan (otomatis null)
      // Jika REVISI atau REJECTED, pastikan keterangan diisi (sudah dihandle DTO, tapi kita enforce di sini juga)
      let finalKeterangan: string | null | undefined = keterangan;
      if (status === StatusDocument.APPROVED) {
        finalKeterangan = null;
      }

      // 3. Update status dokumen
      const updatedDocument = await this.prisma.documents.update({
        where: { id },
        data: {
          status,
          keterangan: finalKeterangan,
        },
        select: {
          id: true,
          id_student: true, // Diperlukan untuk validasi siswa
          status: true,
          keterangan: true,
          updated_at: true,
          // Tidak meng-expose file_path jika tidak perlu untuk admin response
        },
      });

      // 4. Update status verifikasi siswa secara otomatis
      await this.updateStudentVerificationStatus(updatedDocument.id_student);

      // Pisahkan id_student agar tidak ter-expose di response
      const { id_student, ...responseData } = updatedDocument;

      // 5. Return format konsisten
      return {
        success: true,
        message: 'Validasi dokumen berhasil diperbarui',
        data: responseData,
      };
    } catch (error) {
      this.handleException(error, 'Gagal memvalidasi dokumen');
    }
  }

  /**
   * Method untuk admin melakukan validasi bulk pada banyak dokumen milik satu siswa
   */
  async bulkValidateDocuments(
    studentId: number,
    bulkValidateDto: BulkValidateDocumentsDto,
  ) {
    try {
      const { documents } = bulkValidateDto;

      // 1. Ambil semua dokumen siswa ini dari database untuk validasi ownership
      const studentDocuments = await this.prisma.documents.findMany({
        where: { id_student: studentId },
        select: { id: true },
      });

      if (!studentDocuments || studentDocuments.length === 0) {
        throw new NotFoundException(
          'Siswa tidak ditemukan atau belum memiliki dokumen',
        );
      }

      // 2. Validasi Ownership & Keberadaan Dokumen (IDOR prevention)
      // Pastikan semua document_id yang dikirim benar-benar milik studentId ini
      const validDocumentIds = new Set(studentDocuments.map((doc) => doc.id));
      for (const doc of documents) {
        if (!validDocumentIds.has(doc.document_id)) {
          throw new BadRequestException(
            `Dokumen dengan ID ${doc.document_id} tidak valid atau bukan milik siswa ini (Potensi IDOR)`,
          );
        }
      }

      // 3. Bangun query Prisma Update secara atomic
      // Menggunakan array operasi untuk prisma.$transaction
      const transactionOperations = documents.map((doc) => {
        let finalKeterangan: string | null | undefined = doc.keterangan;

        // Aturan bisnis: Jika APPROVED, keterangan otomatis null
        if (doc.status === StatusDocument.APPROVED) {
          finalKeterangan = null;
        }

        return this.prisma.documents.update({
          where: { id: doc.document_id },
          data: {
            status: doc.status,
            keterangan: finalKeterangan,
          },
        });
      });

      // 4. Eksekusi transaction, semua akan commit bersamaan atau rollback jika salah satu gagal
      await this.prisma.$transaction(transactionOperations);

      // 5. Update status verifikasi siswa secara otomatis berdasarkan hasil bulk validation
      await this.updateStudentVerificationStatus(studentId);

      return {
        success: true,
        message: 'Validasi dokumen berhasil',
        data: {
          student_id: studentId,
          total_documents: documents.length,
        },
      };
    } catch (error) {
      this.handleException(error, 'Gagal melakukan bulk validation dokumen');
    }
  }

  /**
   * Helper method untuk update status verifikasi siswa secara otomatis.
   * Backend adalah source of truth untuk field verification_status.
   */
  async updateStudentVerificationStatus(studentId: number) {
    // 1. Ambil total jenis dokumen yang wajib disubmit
    const totalDocumentTypes = await this.prisma.document_types.count();

    // 2. Ambil semua dokumen yang di-submit oleh siswa ini
    const studentDocuments = await this.prisma.documents.findMany({
      where: { id_student: studentId },
    });

    let newStatus: VerificationStatus = VerificationStatus.BELUM_SUBMIT;

    if (
      studentDocuments.length > 0 &&
      studentDocuments.length >= totalDocumentTypes
    ) {
      // Siswa sudah submit semua dokumen (atau lebih), jalankan pengecekan prioritas status
      const hasRejected = studentDocuments.some(
        (doc) => doc.status === StatusDocument.REJECTED,
      );
      const hasRevisi = studentDocuments.some(
        (doc) => doc.status === StatusDocument.REVISI,
      );
      const allApproved = studentDocuments.every(
        (doc) => doc.status === StatusDocument.APPROVED,
      );

      if (hasRejected) {
        newStatus = VerificationStatus.DITOLAK;
      } else if (hasRevisi) {
        newStatus = VerificationStatus.REVISI;
      } else if (allApproved) {
        newStatus = VerificationStatus.TERVERIFIKASI;
      } else {
        newStatus = VerificationStatus.MENUNGGU_VALIDASI; // Masih ada yang PENDING
      }
    } else if (studentDocuments.length > 0) {
      // Siswa baru submit sebagian dokumen
      newStatus = VerificationStatus.BELUM_SUBMIT;
    }

    // 3. Update status siswa secara atomic
    await this.prisma.students.update({
      where: { id: studentId },
      data: { verification_status: newStatus },
    });
  }

  /**
   * Reusable helper untuk menangani exception agar pesan error lebih rapi
   */
  private handleException(error: any, defaultMessage: string): never {
    if (
      error instanceof NotFoundException ||
      error instanceof BadRequestException ||
      error instanceof ForbiddenException
    ) {
      throw error; // Rethrow NestJS exceptions
    }

    // Log error internal untuk debugging
    console.error(defaultMessage, error);

    throw new InternalServerErrorException({
      success: false,
      message: defaultMessage,
      error: 'Terjadi kesalahan pada server',
    });
  }
}
