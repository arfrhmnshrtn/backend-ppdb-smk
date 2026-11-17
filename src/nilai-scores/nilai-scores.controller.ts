import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';
import { NilaiScoresService } from './nilai-scores.service';
import { NilaiScoresExcelService } from './nilai-scores-excel.service';
import { CreateNilaiScoreDto } from './dto/create-nilai-score.dto';
import { UpdateNilaiScoreDto } from './dto/update-nilai-score.dto';
import { QueryNilaiScoreDto } from './dto/query-nilai-score.dto';
import { ConfirmImportNilaiDto } from './dto/confirm-import-nilai.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Jurusan, user_role } from '../../generated/prisma/client';

const MAX_EXCEL_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const excelUploadOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: MAX_EXCEL_FILE_SIZE,
  },
  fileFilter: (
    _req: unknown,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!file.originalname.toLowerCase().endsWith('.xlsx')) {
      return cb(
        new BadRequestException(
          'Format file tidak valid. Hanya file Excel (.xlsx) yang diizinkan',
        ),
        false,
      );
    }
    cb(null, true);
  },
};

@Controller('nilai-scores')
@UseGuards(AuthGuard, RolesGuard)
@Roles(user_role.ADMIN)
export class NilaiScoresController {
  constructor(
    private readonly nilaiScoresService: NilaiScoresService,
    private readonly nilaiScoresExcelService: NilaiScoresExcelService,
  ) {}

  /**
   * Download Template Excel Nilai Ujian per jurusan (.xlsx)
   */
  @Get('excel/template')
  async downloadExcelTemplate(
    @Res() res: Response,
    @Query('major') major?: Jurusan,
    @Query('jurusan') jurusan?: Jurusan,
  ) {
    const selectedMajor = major ?? jurusan;
    const buffer =
      await this.nilaiScoresExcelService.generateTemplateExcel(selectedMajor);
    const filename = selectedMajor
      ? `Template_Nilai_Ujian_PPDB_${selectedMajor.toUpperCase()}.xlsx`
      : 'Template_Nilai_Ujian_PPDB.xlsx';

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length.toString(),
    });

    res.end(buffer);
  }

  @Get('excel/template/:jurusan')
  async downloadExcelTemplateByParam(
    @Res() res: Response,
    @Param('jurusan') jurusan: Jurusan,
  ) {
    return this.downloadExcelTemplate(res, jurusan);
  }

  /**
   * Alias endpoint download template
   */
  @Get('template')
  async downloadExcelTemplateAlias(
    @Res() res: Response,
    @Query('major') major?: Jurusan,
    @Query('jurusan') jurusan?: Jurusan,
  ) {
    return this.downloadExcelTemplate(res, major, jurusan);
  }

  /**
   * Upload & Preview Excel Nilai Ujian per jurusan (validasi tanpa langsung menyimpan ke DB)
   */
  @Post('excel/preview')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', excelUploadOptions))
  async previewExcelImport(
    @UploadedFile() file?: Express.Multer.File,
    @Query('major') queryMajor?: Jurusan,
    @Query('jurusan') queryJurusan?: Jurusan,
    @Body('major') bodyMajor?: Jurusan,
    @Body('jurusan') bodyJurusan?: Jurusan,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException(
        'File Excel (.xlsx) wajib diunggah pada field "file"',
      );
    }

    const selectedMajor =
      queryMajor ?? queryJurusan ?? bodyMajor ?? bodyJurusan;

    const preview = await this.nilaiScoresExcelService.parseAndPreviewExcel(
      file.buffer,
      file.originalname,
      selectedMajor,
    );

    return {
      success: true,
      status: HttpStatus.OK,
      message: 'Berhasil memvalidasi dan membuat preview data nilai ujian',
      data: preview,
    };
  }

  @Post('excel/preview/:jurusan')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', excelUploadOptions))
  async previewExcelImportByParam(
    @Param('jurusan') jurusan: Jurusan,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.previewExcelImport(file, jurusan);
  }

  /**
   * Alias endpoint upload & preview Excel
   */
  @Post('import/preview')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', excelUploadOptions))
  async previewExcelImportAlias(
    @UploadedFile() file?: Express.Multer.File,
    @Query('major') queryMajor?: Jurusan,
    @Query('jurusan') queryJurusan?: Jurusan,
    @Body('major') bodyMajor?: Jurusan,
    @Body('jurusan') bodyJurusan?: Jurusan,
  ) {
    return this.previewExcelImport(
      file,
      queryMajor,
      queryJurusan,
      bodyMajor,
      bodyJurusan,
    );
  }

  /**
   * Konfirmasi Import Nilai Ujian yang sudah lolos validasi ke database (mendukung filter per jurusan).
   */
  @Post('excel/confirm')
  @HttpCode(HttpStatus.OK)
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  )
  @UseInterceptors(FileInterceptor('file', excelUploadOptions))
  async confirmExcelImport(
    @Body() confirmDto?: ConfirmImportNilaiDto,
    @UploadedFile() file?: Express.Multer.File,
    @Query('major') queryMajor?: Jurusan,
    @Query('jurusan') queryJurusan?: Jurusan,
  ) {
    const selectedMajor =
      queryMajor ??
      queryJurusan ??
      (confirmDto?.major as Jurusan | undefined) ??
      (confirmDto?.jurusan as Jurusan | undefined);

    if (file && file.buffer) {
      const preview = await this.nilaiScoresExcelService.parseAndPreviewExcel(
        file.buffer,
        file.originalname,
        selectedMajor,
      );
      if (preview.valid_data.length === 0) {
        throw new BadRequestException({
          message:
            'Tidak ada baris data yang valid pada file Excel untuk disimpan',
          invalid_data: preview.invalid_data,
        });
      }
      const result = await this.nilaiScoresExcelService.confirmImportNilai(
        {
          items: preview.valid_data,
        },
        selectedMajor,
      );
      return {
        success: true,
        status: HttpStatus.OK,
        message: `Berhasil mengimpor ${result.total_imported} data nilai ujian siswa`,
        data: result,
      };
    }

    const result = await this.nilaiScoresExcelService.confirmImportNilai(
      confirmDto,
      selectedMajor,
    );

    return {
      success: true,
      status: HttpStatus.OK,
      message: `Berhasil mengimpor ${result.total_imported} data nilai ujian siswa`,
      data: result,
    };
  }

  @Post('excel/confirm/:jurusan')
  @HttpCode(HttpStatus.OK)
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  )
  @UseInterceptors(FileInterceptor('file', excelUploadOptions))
  async confirmExcelImportByParam(
    @Param('jurusan') jurusan: Jurusan,
    @Body() confirmDto?: ConfirmImportNilaiDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.confirmExcelImport(confirmDto, file, jurusan);
  }

  /**
   * Alias endpoint konfirmasi import
   */
  @Post('excel/import')
  @HttpCode(HttpStatus.OK)
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  )
  @UseInterceptors(FileInterceptor('file', excelUploadOptions))
  async confirmExcelImportAlias(
    @Body() confirmDto?: ConfirmImportNilaiDto,
    @UploadedFile() file?: Express.Multer.File,
    @Query('major') queryMajor?: Jurusan,
    @Query('jurusan') queryJurusan?: Jurusan,
  ) {
    return this.confirmExcelImport(
      confirmDto,
      file,
      queryMajor,
      queryJurusan,
    );
  }

  @Post('import/confirm')
  @HttpCode(HttpStatus.OK)
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  )
  @UseInterceptors(FileInterceptor('file', excelUploadOptions))
  async confirmExcelImportSecondAlias(
    @Body() confirmDto?: ConfirmImportNilaiDto,
    @UploadedFile() file?: Express.Multer.File,
    @Query('major') queryMajor?: Jurusan,
    @Query('jurusan') queryJurusan?: Jurusan,
  ) {
    return this.confirmExcelImport(
      confirmDto,
      file,
      queryMajor,
      queryJurusan,
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createNilaiScoreDto: CreateNilaiScoreDto) {
    const data = await this.nilaiScoresService.create(createNilaiScoreDto);
    return {
      success: true,
      status: HttpStatus.CREATED,
      message: 'Nilai berhasil ditambahkan',
      data,
    };
  }

  @Get()
  async findAll(@Query() query: QueryNilaiScoreDto) {
    const result = await this.nilaiScoresService.findAll(query);
    return {
      success: true,
      status: HttpStatus.OK,
      meta: result.meta,
      message: 'Data nilai berhasil diambil',
      data: result.data,
    };
  }

  @Get('status')
  async findScoreStatus(@Query() query: QueryNilaiScoreDto) {
    const result = await this.nilaiScoresService.findScoreStatus(query);
    return {
      success: true,
      status: HttpStatus.OK,
      meta: result.meta,
      message: 'Data status nilai student berhasil diambil',
      data: result.data,
    };
  }

  @Get('student/:studentId')
  async findByStudentId(@Param('studentId', ParseIntPipe) studentId: number) {
    const data = await this.nilaiScoresService.findByStudentId(studentId);
    return {
      success: true,
      message: 'Data nilai student berhasil diambil',
      data,
    };
  }

  // filter by jurusan
  @Get('jurusan/:jurusan')
  async findAllByJurusan(@Param('jurusan') jurusan: string) {
    const result = await this.nilaiScoresService.findAllByJurusan(jurusan);
    return {
      success: true,
      message: 'Data nilai jurusan ' + jurusan + ' berhasil diambil',
      data: result,
    };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateNilaiScoreDto: UpdateNilaiScoreDto,
  ) {
    const data = await this.nilaiScoresService.update(id, updateNilaiScoreDto);
    return {
      success: true,
      message: 'Nilai berhasil diupdate',
      data,
    };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.nilaiScoresService.remove(id);
    return {
      success: true,
      message: 'Nilai berhasil dihapus',
    };
  }
}
