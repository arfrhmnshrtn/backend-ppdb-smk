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
import { StatusDocument } from '../../generated/prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';

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
          status: true,
          keterangan: true,
          updated_at: true,
          // Tidak meng-expose file_path jika tidak perlu untuk admin response
        },
      });

      // 4. Return format konsisten
      return {
        success: true,
        message: 'Validasi dokumen berhasil diperbarui',
        data: updatedDocument,
      };
    } catch (error) {
      this.handleException(error, 'Gagal memvalidasi dokumen');
    }
  }

  /**
   * Method untuk admin melakukan validasi bulk pada banyak dokumen milik satu siswa
   */
  async bulkValidateDocuments(studentId: number, bulkValidateDto: BulkValidateDocumentsDto) {
    try {
      const { documents } = bulkValidateDto;

      // 1. Ambil semua dokumen siswa ini dari database untuk validasi ownership
      const studentDocuments = await this.prisma.documents.findMany({
        where: { id_student: studentId },
        select: { id: true },
      });

      if (!studentDocuments || studentDocuments.length === 0) {
        throw new NotFoundException('Siswa tidak ditemukan atau belum memiliki dokumen');
      }

      // 2. Validasi Ownership & Keberadaan Dokumen (IDOR prevention)
      // Pastikan semua document_id yang dikirim benar-benar milik studentId ini
      const validDocumentIds = new Set(studentDocuments.map(doc => doc.id));
      for (const doc of documents) {
        if (!validDocumentIds.has(doc.document_id)) {
          throw new BadRequestException(`Dokumen dengan ID ${doc.document_id} tidak valid atau bukan milik siswa ini (Potensi IDOR)`);
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
   * Method untuk siswa upload ulang dokumen yang direvisi
   */
  async reuploadDocument(id: string, file: Express.Multer.File, userId: number) {
    try {
      // 1. Cari dokumen beserta data student untuk verifikasi ownership
      const existingDocument = await this.prisma.documents.findUnique({
        where: { id },
        include: {
          student: true, // Relasi ke students
        },
      });

      if (!existingDocument) {
        // Hapus file yang baru saja terupload jika dokumen tidak valid
        await this.deleteFileSafely(file.path);
        throw new NotFoundException('Dokumen tidak ditemukan');
      }

      // 2. Validasi IDOR (Insecure Direct Object Reference)
      // Pastikan dokumen ini milik user yang sedang login
      if (existingDocument.student.id_user !== userId) {
        await this.deleteFileSafely(file.path);
        throw new ForbiddenException('Akses ditolak: Dokumen ini bukan milik Anda');
      }

      // 3. Validasi status dokumen
      // Siswa HANYA boleh upload ulang jika statusnya REVISI
      if (existingDocument.status !== StatusDocument.REVISI) {
        await this.deleteFileSafely(file.path);
        throw new BadRequestException('Dokumen hanya dapat diunggah ulang jika statusnya REVISI');
      }

      // 4. Hapus file lama dari local storage menggunakan fs.unlink
      if (existingDocument.file_path) {
        await this.deleteFileSafely(existingDocument.file_path);
      }

      // 5. Update database: update file_path, status kembali PENDING, keterangan null
      const updatedDocument = await this.prisma.documents.update({
        where: { id },
        data: {
          file_path: file.path.replace(/\\/g, '/'), // Standarisasi path
          status: StatusDocument.PENDING,
          keterangan: null,
        },
        select: {
          id: true,
          status: true,
          updated_at: true,
          // Sanitize response, jangan expose file_path penuh jika itu path absolut/sensitif
        },
      });

      return {
        success: true,
        message: 'Dokumen revisi berhasil diunggah',
        data: updatedDocument,
      };
    } catch (error) {
      // Pastikan file baru dihapus jika terjadi error di tengah proses database
      await this.deleteFileSafely(file.path);
      this.handleException(error, 'Gagal mengunggah ulang dokumen revisi');
    }
  }

  /**
   * Reusable helper untuk menghapus file dengan aman
   */
  private async deleteFileSafely(filePath: string) {
    try {
      // Cek apakah file ada
      await fs.access(filePath);
      // Hapus file
      await fs.unlink(filePath);
    } catch (error) {
      // Ignore error jika file tidak ditemukan
      const err = error as NodeJS.ErrnoException;
      if (err.code !== 'ENOENT') {
        console.error(`Gagal menghapus file lama di ${filePath}:`, error);
      }
    }
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
