import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../lib/prisma.service.js';
import { StatusDocument } from '../../generated/prisma/client';

@Injectable()
export class UsersService {
  private readonly prisma = PrismaService;

  async findByJurusan(jurusan?: string) {
    try {
      // Jika ada query jurusan, filter berdasarkan relasi berkas
      const whereCondition = jurusan
        ? {
            students: {
              jurusan: jurusan.toUpperCase() as any,
            },
          }
        : {}; // Jika tidak ada, kembalikan semua user

      const users = await this.prisma.user.findMany({
        where: whereCondition,
        include: {
          students: true, // Sertakan data students agar info jurusan terlihat
        },
      });

      return {
        status: true,
        message: jurusan
          ? `Berhasil mengambil data siswa jurusan ${jurusan.toUpperCase()}`
          : 'Berhasil mengambil semua data siswa',
        metadata: {
          statusCode: HttpStatus.OK,
          length: users.length,
        },
        data: users.map((user) => ({
          idUser: user.id,
          no_daftar: user.students?.no_daftar || null,
          email: user.email,
          nama: user.students?.nama || null,
          jurusan: user.students?.jurusan || null,
          no_hp: user.students?.no_hp || null,
          nisn: user.students?.nisn || null,
          asal_sekolah: user.students?.asal_sekolah || null,
          akreditasi_sekolah: user.students?.akreditasi_sekolah || null,
          alamat: user.students?.alamat || null,
          status_berkas: user.students?.verification_status || null,
        })),
      };
    } catch (error) {
      console.error('Error findByJurusan:', error);
      throw new InternalServerErrorException(
        'Terjadi kesalahan saat mengambil data user',
      );
    }
  }

  async getRegistrationStatus(userId: number) {
    try {
      const student = await this.prisma.students.findUnique({
        where: { id_user: userId },
        include: {
          documents: {
            include: { document_type: true },
          },
        },
      });

      if (!student) {
        throw new NotFoundException(
          'Data pendaftaran tidak ditemukan. Siswa belum mensubmit berkas.',
        );
      }

      // Filter dokumen yang berstatus REVISI atau REJECTED saja
      const problemDocuments = student.documents
        .filter(
          (doc) =>
            doc.status === StatusDocument.REVISI ||
            doc.status === StatusDocument.REJECTED,
        )
        .map((doc) => ({
          id: doc.id,
          type: doc.document_type.name,
          status: doc.status,
          keterangan: doc.keterangan || 'Tidak ada keterangan',
          updated_at: doc.updated_at,
        }));

      return {
        success: true,
        message: 'Berhasil mengambil status pendaftaran',
        data: {
          verification_status: student.verification_status,
          documents_need_revision: problemDocuments,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error; // Rethrow 404
      }
      console.error('Error getRegistrationStatus:', error);
      throw new InternalServerErrorException(
        'Terjadi kesalahan saat mengambil status pendaftaran',
      );
    }
  }
}
