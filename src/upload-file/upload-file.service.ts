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

  constructor() {}

  async uploadFile(
    dto: CreateUploadFileDto,
    files: UploadFileFields,
    userId: number,
  ) {
    try {
      // cek apakah user sudah pernah mengupload berkas sebelumnya
      const existingBerkas = await this.prisma.berkas.findFirst({
        where: { idUser: userId },
      });

      if (existingBerkas) {
        throw new BadRequestException(
          'User sudah pernah mengupload berkas sebelumnya',
        );
      }

      // Generate no_daftar secara lebih aman menggunakan crypto
      const crypto = require('crypto');
      const randomNum = crypto.randomInt(100000, 999999);
      const no_daftar = `SPMB-${randomNum}`;

      const getPath = (fileArray?: Express.Multer.File[]) => {
        const filename = fileArray?.[0]?.filename;
        return filename ? `/uploads/${userId}/${filename}` : null;
      };

      const getRequiredPath = (fileArray?: Express.Multer.File[]) => {
        const filename = fileArray?.[0]?.filename;
        return filename ? `/uploads/${userId}/${filename}` : '';
      };

      await this.prisma.berkas.create({
        data: {
          ...dto,
          idUser: userId,
          no_daftar: no_daftar,
          surat_keterangan_lulus: getRequiredPath(files.surat_keterangan_lulus),
          raport: getRequiredPath(files.raport),
          ktp_ayah: getPath(files.ktp_ayah),
          ktp_ibu: getPath(files.ktp_ibu),
          kartu_keluarga: getRequiredPath(files.kartu_keluarga),
          akta_kelahiran: getRequiredPath(files.akta_kelahiran),
          pas_foto: getRequiredPath(files.pas_foto),
          sptjm: getRequiredPath(files.sptjm),
          kip: getPath(files.kip),
          paiagam: getPath(files.paiagam),
          sk_osis: getPath(files.sk_osis),
          sk_pramuka: getPath(files.sk_pramuka),
        },
      });
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

  // update file 
  async updateFile(
    dto: UpdateUploadFileDto,
    files: UploadFileFields,
    userId: number,
  ) {
    try {
      const existingBerkas = await this.prisma.berkas.findFirst({
        where: { idUser: userId },
      });

      if (!existingBerkas) {
        throw new NotFoundException('Berkas tidak ditemukan');
      }

      // Validasi: hanya bisa update jika statusnya REVISI
      if (existingBerkas.status_berkas !== 'REVISI') {
        throw new BadRequestException(
          'Berkas tidak bisa diupdate. Hanya berkas dengan status REVISI yang dapat diubah.',
        );
      }

      // Gunakan 'undefined' jika tidak ada file baru, agar Prisma tidak menimpa data lama dengan null/kosong
      const getPathForUpdate = (fileArray?: Express.Multer.File[]) => {
        const filename = fileArray?.[0]?.filename;
        return filename ? `/uploads/${userId}/${filename}` : undefined;
      };

      await this.prisma.berkas.update({
        where: { id: existingBerkas.id }, // Harus menggunakan 'id' karena 'idUser' belum ditandai @unique di Prisma
        data: {
          ...dto,
          surat_keterangan_lulus: getPathForUpdate(files.surat_keterangan_lulus),
          raport: getPathForUpdate(files.raport),
          ktp_ayah: getPathForUpdate(files.ktp_ayah),
          ktp_ibu: getPathForUpdate(files.ktp_ibu),
          kartu_keluarga: getPathForUpdate(files.kartu_keluarga),
          akta_kelahiran: getPathForUpdate(files.akta_kelahiran),
          pas_foto: getPathForUpdate(files.pas_foto),
          sptjm: getPathForUpdate(files.sptjm),
          kip: getPathForUpdate(files.kip),
          paiagam: getPathForUpdate(files.paiagam),
          sk_osis: getPathForUpdate(files.sk_osis),
          sk_pramuka: getPathForUpdate(files.sk_pramuka),
          status_berkas: 'PENDING', // Set status kembali ke PENDING untuk direview ulang admin
        },
      });

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

  // findallBerkas
  async findAllBerkas(userId: number){
    try {
      // CEK APAKAH ROLE ADMIN
      const admin = await this.prisma.user.findFirst({
        where: { id: userId, role: "ADMIN" },
      });
      if(!admin){
        throw new ForbiddenException(
          'Anda tidak memiliki akses untuk melihat berkas. Fitur ini khusus ADMIN.',
        );
      }
      const berkas = await this.prisma.berkas.findMany();
      return {
        status: true,
        message: 'Berkas berhasil ditemukan',
        metadata: {
          statusCode: HttpStatus.OK,
          length: berkas.length,
        },
        data: berkas,
      };
    }catch(error){
      if (error instanceof ForbiddenException) {
        throw error;
      }
      if(error instanceof Error){
        console.error('Error message:', error.message);
      }
      throw new InternalServerErrorException(
        'Terjadi kesalahan saat findall berkas',
      );
    }
  }
}
