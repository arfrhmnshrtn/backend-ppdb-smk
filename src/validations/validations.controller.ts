import {
  Controller,
  Patch,
  Param,
  Body,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Req,
  BadRequestException,
  ParseIntPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { ValidationsService } from './validations.service';
import { ValidateDocumentDto } from './dto/validate-document.dto';
import { BulkValidateDocumentsDto } from './dto/bulk-validate-documents.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../../generated/prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as crypto from 'crypto';
import { extname } from 'path';

// Konfigurasi Multer untuk upload ulang file revisi
const multerOptions = {
  storage: diskStorage({
    destination: './uploads/documents',
    filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
      // Ekstrak original extension dan cegah path traversal
      const ext = extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
      // Rename menggunakan UUID agar aman
      const filename = `${crypto.randomUUID()}${ext}`;
      cb(null, filename);
    },
  }),
  fileFilter: (req: Request, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
    // Whitelist mime type
    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestException('Format file tidak didukung. Hanya PDF, JPG, JPEG, dan PNG.'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // Limit 5MB
  },
};

@Controller('validations')
@UseGuards(AuthGuard, RolesGuard)
export class ValidationsController {
  constructor(private readonly validationsService: ValidationsService) {}

  /**
   * Endpoint Admin untuk memvalidasi dokumen
   * Security:
   * - JwtAuthGuard: Memastikan user sudah login
   * - RolesGuard: Memastikan hanya ADMIN yang bisa akses
   * - Dto validation class-validator
   */
  @Patch('documents/:id')
  @Roles(Role.ADMIN)
  async validateDocument(
    @Param('id') id: string,
    @Body() validateDocumentDto: ValidateDocumentDto,
  ) {
    return this.validationsService.validateDocument(id, validateDocumentDto);
  }

  /**
   * Endpoint Admin untuk memvalidasi banyak dokumen sekaligus
   * Security:
   * - Transactional via Service
   * - Validasi studentId dan IDOR di service
   */
  @Patch('students/:studentId/documents')
  @Roles(Role.ADMIN)
  async bulkValidateDocuments(
    @Param('studentId', ParseIntPipe) studentId: number,
    @Body() bulkValidateDto: BulkValidateDocumentsDto,
  ) {
    return this.validationsService.bulkValidateDocuments(studentId, bulkValidateDto);
  }

  /**
   * Endpoint Siswa untuk upload ulang dokumen revisi
   * Security:
   * - JwtAuthGuard: Memastikan user sudah login
   * - RolesGuard: Memastikan hanya USER yang bisa akses
   * - FileInterceptor dengan filter MIME type dan ukuran limit
   */
  @Patch('documents/:id/reupload')
  @Roles(Role.USER)
  @UseInterceptors(FileInterceptor('file', multerOptions))
  async reuploadDocument(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /(pdf|jpeg|jpg|png)$/i }),
        ],
      }),
    ) file: Express.Multer.File,
    @Req() req: import('express').Request & { user: { sub: number; role: string } },
  ) {
    // ID User dari token JWT (AuthGuard menaruhnya di req.user.sub)
    const userId = req.user.sub;
    
    if (!file) {
      throw new BadRequestException('File tidak ditemukan');
    }

    return this.validationsService.reuploadDocument(id, file, userId);
  }
}
