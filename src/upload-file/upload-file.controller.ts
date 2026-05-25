import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { UploadFileService } from './upload-file.service';
import { CreateUploadFileDto } from './dto/create-upload-file.dto';
import { UpdateUploadFileDto } from './dto/update-upload-file.dto';
import * as fs from 'fs';
import { FileInterceptor } from '@nestjs/platform-express';
import { UseInterceptors, UploadedFiles, UseGuards, Req } from '@nestjs/common';
import { diskStorage } from 'multer';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AuthGuard } from '../auth/auth.guard';
import { CleanUploadedFilesInterceptor } from '../common/interceptors/file-cleanup.interceptor';

const uploadPath = './uploads';

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath);
}

@Controller('berkas')
export class UploadFileController {
  constructor(private readonly uploadFileService: UploadFileService) {}

  @Post('/upload')
  @UseGuards(AuthGuard)
  @UseInterceptors(
    CleanUploadedFilesInterceptor,
    FileFieldsInterceptor(
      [
        { name: 'surat_keterangan_lulus', maxCount: 1 },
        { name: 'raport', maxCount: 1 },
        { name: 'ktp_ayah', maxCount: 1 },
        { name: 'ktp_ibu', maxCount: 1 },
        { name: 'kartu_keluarga', maxCount: 1 },
        { name: 'akta_kelahiran', maxCount: 1 },
        { name: 'pas_foto', maxCount: 1 },
        { name: 'sptjm', maxCount: 1 },
        { name: 'kip', maxCount: 1 },
        { name: 'paiagam', maxCount: 1 },
        { name: 'sk_osis', maxCount: 1 },
        { name: 'sk_pramuka', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: (req: any, file, cb) => {
            // buat folder lagi sesuai id user (dari JWT payload)
            const userId = req.user?.sub;
            const folderPath = `${uploadPath}/${userId}`;
            if (!fs.existsSync(folderPath)) {
              fs.mkdirSync(folderPath);
            }
            cb(null, folderPath);
          },
          filename: (req, file, cb) => {
            const crypto = require('crypto');
            const fileExt = file.originalname.split('.').pop();
            const uniqueName = crypto.randomUUID() + '.' + fileExt;
            cb(null, uniqueName);
          },
        }),
        limits: {
          fileSize: 5 * 1024 * 1024, // 5MB limit
        },
        fileFilter: (req, file, cb) => {
          // Hanya izinkan PDF dan gambar (jpeg, png)
          if (!file.originalname.match(/\.(pdf|jpg|jpeg|png)$/i)) {
            return cb(
              new Error('Hanya file PDF dan gambar yang diizinkan!'),
              false,
            );
          }
          cb(null, true);
        },
      },
    ),
  )
  uploadFile(
    @Req() req: any,
    @Body() dto: CreateUploadFileDto,
    @UploadedFiles()
    files: {
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
    },
  ) {
    const userId = req.user?.sub;
    return this.uploadFileService.uploadFile(dto, files, userId);
  }

  @Patch('/edit')
  @UseGuards(AuthGuard)
  @UseInterceptors(
    CleanUploadedFilesInterceptor,
    FileFieldsInterceptor(
      [
        { name: 'surat_keterangan_lulus', maxCount: 1 },
        { name: 'raport', maxCount: 1 },
        { name: 'ktp_ayah', maxCount: 1 },
        { name: 'ktp_ibu', maxCount: 1 },
        { name: 'kartu_keluarga', maxCount: 1 },
        { name: 'akta_kelahiran', maxCount: 1 },
        { name: 'pas_foto', maxCount: 1 },
        { name: 'sptjm', maxCount: 1 },
        { name: 'kip', maxCount: 1 },
        { name: 'paiagam', maxCount: 1 },
        { name: 'sk_osis', maxCount: 1 },
        { name: 'sk_pramuka', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: (req: any, file, cb) => {
            // buat folder lagi sesuai id user (dari JWT payload)
            const userId = req.user?.sub;
            const folderPath = `${uploadPath}/${userId}`;
            if (!fs.existsSync(folderPath)) {
              fs.mkdirSync(folderPath);
            }
            cb(null, folderPath);
          },
          filename: (req, file, cb) => {
            const crypto = require('crypto');
            const fileExt = file.originalname.split('.').pop();
            const uniqueName = crypto.randomUUID() + '.' + fileExt;
            cb(null, uniqueName);
          },
        }),
        limits: {
          fileSize: 5 * 1024 * 1024, // 5MB limit
        },
        fileFilter: (req, file, cb) => {
          // Hanya izinkan PDF dan gambar (jpeg, png)
          if (!file.originalname.match(/\.(pdf|jpg|jpeg|png)$/i)) {
            return cb(
              new Error('Hanya file PDF dan gambar yang diizinkan!'),
              false,
            );
          }
          cb(null, true);
        },
      },
    ),
  )
  updateFile(
    @Req() req: any,
    @Body() dto: UpdateUploadFileDto,
    @UploadedFiles()
    files: {
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
    },
  ) {
    const userId = req.user?.sub;
    return this.uploadFileService.updateFile(dto, files, userId);
  }

  // lihat semua berkas
  @Get('/all-berkas')
  @UseGuards(AuthGuard)
  findAllBerkas(@Req() req: any) {
    const userId = req.user?.sub;
    return this.uploadFileService.findAllBerkas(userId);
  }

  // lihat berkas per id student
  @Get('/student/:studentId')
  @UseGuards(AuthGuard)
  findBerkasByStudentId(
    @Req() req: any,
    @Param('studentId') studentId: string,
  ) {
    const userId = req.user?.sub;
    return this.uploadFileService.findBerkasByStudentId(
      userId,
      parseInt(studentId, 10),
    );
  }
}
