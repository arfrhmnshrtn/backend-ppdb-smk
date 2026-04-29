import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../lib/prisma.service.js';
import { HttpStatus } from '@nestjs/common';

@Injectable()
export class UsersService {
  private readonly prisma = PrismaService;

  async findByJurusan(jurusan?: string) {
    try {
      // Jika ada query jurusan, filter berdasarkan relasi berkas
      const whereCondition = jurusan
        ? {
            berkas: {
              some: {
                jurusan: jurusan.toUpperCase() as any,
              },
            },
          }
        : {}; // Jika tidak ada, kembalikan semua user

      const users = await this.prisma.user.findMany({
        where: whereCondition,
        include: {
          berkas: true, // Sertakan data berkas agar info jurusan terlihat
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
          no_daftar: user.berkas[0]?.no_daftar || null,
          email: user.email,
          nama: user.berkas[0]?.nama || null,
          jurusan: user.berkas[0]?.jurusan || null,
          no_hp: user.berkas[0]?.no_hp || null,
          nisn: user.berkas[0]?.nisn || null,
          asal_sekolah: user.berkas[0]?.asal_sekolah || null,
          alamat: user.berkas[0]?.alamat || null,
        })),
      };
    } catch (error) {
      console.error('Error findByJurusan:', error);
      throw new InternalServerErrorException(
        'Terjadi kesalahan saat mengambil data user',
      );
    }
  }
}
