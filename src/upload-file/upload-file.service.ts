import {
  BadRequestException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
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

      const getPath = (fileArray?: Express.Multer.File[]) => {
        const filename = fileArray?.[0]?.filename;
        return filename ? `/uploads/${filename}` : null;
      };

      const getRequiredPath = (fileArray?: Express.Multer.File[]) => {
        const filename = fileArray?.[0]?.filename;
        return filename ? `/uploads/${filename}` : '';
      };

      // Generate no_daftar automatically
      const no_daftar = `SPMB-${Math.floor(100000 + Math.random() * 900000)}`; // e.g. SPMB-123456

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
}
