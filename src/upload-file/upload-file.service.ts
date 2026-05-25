import {
  BadRequestException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { CreateUploadFileDto } from './dto/create-upload-file.dto';
import { UpdateUploadFileDto } from './dto/update-upload-file.dto';
import { PrismaService } from '../lib/prisma.service.js';
import { ValidationsService } from '../validations/validations.service';
import * as fs from 'fs/promises';

export type UploadFileFields = {
  surat_keterangan_lulus?: Express.Multer.File[];
  raport?: Express.Multer.File[];
  ktp_ayah?: Express.Multer.File[];
  ktp_ibu?: Express.Multer.File[];
  kartu_keluarga?: Express.Multer.File[];
  akta_kelahiran?: Express.Multer.File[];
  pas_foto?: Express.Multer.File[];
  sptjm?: Express.Multer.File[];
  kip?: Express.Multer.File[];
  paiagam?: Express.Multer.File[];
  sk_osis?: Express.Multer.File[];
  sk_pramuka?: Express.Multer.File[];
};

@Injectable()
export class UploadFileService {
  private readonly prisma = PrismaService;

  constructor(private validationsService: ValidationsService) {}

  private async processDocument(
    studentId: number,
    userId: number,
    documentName: string,
    fileArray?: Express.Multer.File[],
    existingDocument?: any,
  ) {
    if (!fileArray || fileArray.length === 0) return;

    const filename = fileArray[0].filename;
    const filePath = `/uploads/${userId}/${filename}`;

    // Pastikan document_type ada
    const docType = await this.prisma.document_types.upsert({
      where: { name: documentName },
      update: {},
      create: { name: documentName },
    });

    if (existingDocument) {
      // Hapus file lama jika ada
      if (existingDocument.file_path) {
        await this.deleteFileSafely(existingDocument.file_path);
      }

      await this.prisma.documents.update({
        where: { id: existingDocument.id },
        data: {
          file_path: filePath,
          status: 'PENDING', // Kembali ke PENDING setelah direvisi
          keterangan: null, // Hapus keterangan karena dokumen sudah direvisi
        },
      });
    } else {
      await this.prisma.documents.create({
        data: {
          id_student: studentId,
          id_document_type: docType.id,
          file_path: filePath,
          status: 'PENDING',
        },
      });
    }
  }

  private async deleteFileSafely(filePath: string) {
    try {
      const fullPath = filePath.startsWith('/') ? `.${filePath}` : filePath;
      await fs.access(fullPath);
      await fs.unlink(fullPath);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== 'ENOENT') {
        console.error(`Gagal menghapus file lama di ${filePath}:`, error);
      }
    }
  }

  async uploadFile(
    dto: CreateUploadFileDto,
    files: UploadFileFields,
    userId: number,
  ) {
    try {
      const existingStudent = await this.prisma.students.findFirst({
        where: { id_user: userId },
      });

      if (existingStudent) {
        throw new BadRequestException(
          'User sudah pernah mengisi data pendaftaran',
        );
      }

      const crypto = require('crypto');
      const randomNum = crypto.randomInt(100000, 999999);
      const no_daftar = `SPMB-${randomNum}`;

      // 1. Simpan data student
      const student = await this.prisma.students.create({
        data: {
          id_user: userId,
          no_daftar: no_daftar,
          nama: dto.nama,
          no_hp: dto.no_hp,
          nisn: dto.nisn,
          asal_sekolah: dto.asal_sekolah,
          akreditasi_sekolah: dto.akreditasi_sekolah,
          alamat: dto.alamat,
          jurusan: dto.jurusan,
        },
      });

      // 2. Simpan semua file sebagai documents
      const documentFields = [
        'surat_keterangan_lulus',
        'raport',
        'ktp_ayah',
        'ktp_ibu',
        'kartu_keluarga',
        'akta_kelahiran',
        'pas_foto',
        'sptjm',
        'kip',
        'paiagam',
        'sk_osis',
        'sk_pramuka',
      ];

      for (const field of documentFields) {
        if (files[field as keyof UploadFileFields]) {
          await this.processDocument(
            student.id,
            userId,
            field,
            files[field as keyof UploadFileFields],
          );
        }
      }

      // 3. Update status verifikasi otomatis setelah submit berkas awal
      await this.validationsService.updateStudentVerificationStatus(student.id);

      return {
        status: true,
        message: 'Berkas berhasil diupload',
        metadata: {
          statusCode: HttpStatus.CREATED,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error instanceof Error) {
        console.error('Error message:', error.message);
      }
      throw new InternalServerErrorException(
        'Terjadi kesalahan saat upload berkas',
      );
    }
  }

  async updateFile(
    dto: UpdateUploadFileDto,
    files: UploadFileFields,
    userId: number,
  ) {
    try {
      const student = await this.prisma.students.findFirst({
        where: { id_user: userId },
        include: {
          documents: {
            include: { document_type: true },
          },
        },
      });

      if (!student) {
        throw new NotFoundException('Data siswa tidak ditemukan');
      }

      // Validasi: Cek apakah ada dokumen yang berstatus REVISI
      const hasRevisi = student.documents.some(
        (doc) => doc.status === 'REVISI',
      );
      if (!hasRevisi && student.documents.length > 0) {
        throw new BadRequestException(
          'Berkas tidak bisa diupdate. Hanya berkas dengan status REVISI yang dapat diubah.',
        );
      }

      // Update data student
      await this.prisma.students.update({
        where: { id: student.id },
        data: {
          nama: dto.nama,
          no_hp: dto.no_hp,
          nisn: dto.nisn,
          asal_sekolah: dto.asal_sekolah,
          akreditasi_sekolah: dto.akreditasi_sekolah,
          alamat: dto.alamat,
          jurusan: dto.jurusan,
        },
      });

      // Update files
      const documentFields = [
        'surat_keterangan_lulus',
        'raport',
        'ktp_ayah',
        'ktp_ibu',
        'kartu_keluarga',
        'akta_kelahiran',
        'pas_foto',
        'sptjm',
        'kip',
        'paiagam',
        'sk_osis',
        'sk_pramuka',
      ];

      for (const field of documentFields) {
        if (files[field as keyof UploadFileFields]) {
          const existingDoc = student.documents.find(
            (d) => d.document_type.name === field,
          );
          await this.processDocument(
            student.id,
            userId,
            field,
            files[field as keyof UploadFileFields],
            existingDoc,
          );
        }
      }

      // Update status verifikasi otomatis setelah revisi via modul berkas
      await this.validationsService.updateStudentVerificationStatus(student.id);

      return {
        status: true,
        message: 'Berkas berhasil diupdate',
        metadata: {
          statusCode: HttpStatus.OK,
        },
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      if (error instanceof Error) {
        console.error('Error message:', error.message);
      }
      throw new InternalServerErrorException(
        'Terjadi kesalahan saat update berkas',
      );
    }
  }

  async findAllBerkas(userId: number) {
    try {
      const admin = await this.prisma.user.findFirst({
        where: { id: userId, role: 'ADMIN' },
      });

      if (!admin) {
        throw new ForbiddenException(
          'Anda tidak memiliki akses untuk melihat berkas. Fitur ini khusus ADMIN.',
        );
      }

      const studentsData = await this.prisma.students.findMany({
        include: {
          user: { select: { email: true } },
          documents: {
            include: {
              document_type: true,
            },
          },
        },
      });

      // Format response agar lebih mudah dibaca oleh frontend
      const formattedData = studentsData.map((student) => {
        const files: Record<string, any> = {};
        student.documents.forEach((doc) => {
          const publicPath = doc.file_path
            ? doc.file_path.replace(/^\/uploads/, '/files')
            : null;

          files[doc.document_type.name] = {
            id: doc.id,
            path: publicPath,
            status: doc.status,
            keterangan: doc.keterangan,
            updated_at: doc.updated_at,
          };
        });

        return {
          id: student.id,
          no_daftar: student.no_daftar,
          nama: student.nama,
          email: student.user.email,
          no_hp: student.no_hp,
          nisn: student.nisn,
          asal_sekolah: student.asal_sekolah,
          akreditasi_sekolah: student.akreditasi_sekolah,
          alamat: student.alamat,
          jurusan: student.jurusan,
          created_at: student.created_at,
          berkas: files,
        };
      });

      return {
        status: true,
        message: 'Data berhasil ditemukan',
        metadata: {
          statusCode: HttpStatus.OK,
          length: formattedData.length,
        },
        data: formattedData,
      };
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      if (error instanceof Error) {
        console.error('Error message:', error.message);
      }
      throw new InternalServerErrorException(
        'Terjadi kesalahan saat findall berkas',
      );
    }
  }

  async findBerkasByStudentId(userId: number, studentId: number) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      const studentData = await this.prisma.students.findUnique({
        where: { id: studentId },
        include: {
          user: { select: { email: true } },
          documents: {
            include: {
              document_type: true,
            },
          },
        },
      });

      if (!studentData) {
        throw new NotFoundException('Data siswa tidak ditemukan');
      }

      if (user?.role !== 'ADMIN' && studentData.id_user !== userId) {
        throw new ForbiddenException(
          'Anda tidak memiliki akses untuk melihat berkas siswa ini.',
        );
      }

      const files: Record<string, any> = {};
      studentData.documents.forEach((doc) => {
        // Map /uploads/ path to relative URL /files/ for public access
        const publicPath = doc.file_path
          ? doc.file_path.replace(/^\/uploads/, '/files')
          : null;

        files[doc.document_type.name] = {
          id: doc.id,
          path: publicPath,
          status: doc.status,
          keterangan: doc.keterangan,
          updated_at: doc.updated_at,
        };
      });

      return {
        status: true,
        message: 'Data berkas berhasil ditemukan',
        metadata: {
          statusCode: HttpStatus.OK,
        },
        data: {
          id: studentData.id,
          no_daftar: studentData.no_daftar,
          nama: studentData.nama,
          email: studentData.user.email,
          no_hp: studentData.no_hp,
          nisn: studentData.nisn,
          asal_sekolah: studentData.asal_sekolah,
          akreditasi_sekolah: studentData.akreditasi_sekolah,
          alamat: studentData.alamat,
          jurusan: studentData.jurusan,
          created_at: studentData.created_at,
          berkas: files,
        },
      };
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      if (error instanceof Error) {
        console.error('Error message:', error.message);
      }
      throw new InternalServerErrorException(
        'Terjadi kesalahan saat mencari berkas',
      );
    }
  }
}
