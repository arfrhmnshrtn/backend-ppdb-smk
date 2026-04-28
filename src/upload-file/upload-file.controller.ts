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
import { UseInterceptors, UploadedFiles } from '@nestjs/common';
import { diskStorage } from 'multer';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

const uploadPath = './uploads';

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath);
}

@Controller('upload-file')
export class UploadFileController {
  constructor(private readonly uploadFileService: UploadFileService) {}

  @Post()
  @UseInterceptors(
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
          destination: (req, file, cb) => {
            // buat folder lagi sesuai id user
            const folderPath = `${uploadPath}/${req.body.idUser}`;
            if (!fs.existsSync(folderPath)) {
              fs.mkdirSync(folderPath);
            }
            cb(null, folderPath);
          },
          filename: (req, file, cb) => {
            const fileExt = file.originalname.split('.').pop();
            const uniqueName = Date.now() + '-' + file.fieldname + '.' + fileExt;
            cb(null, uniqueName);
          },
        }),
      },
    ),
  )
  uploadFile(
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

    return this.uploadFileService.uploadFile(dto, files);
  }
}
