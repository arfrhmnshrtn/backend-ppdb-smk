import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { RaporScoresService } from './rapor-scores.service';
import { CreateRaporScoreDto } from './dto/create-rapor-score.dto';
import { UpdateRaporScoreDto } from './dto/update-rapor-score.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { user_role } from '../../generated/prisma/client';

/**
 * Controller CRUD untuk RaporScore.
 * Seluruh endpoint hanya dapat diakses oleh ADMIN.
 */
@Controller('rapor-scores')
@UseGuards(AuthGuard, RolesGuard)
@Roles(user_role.ADMIN)
export class RaporScoresController {
  constructor(private readonly raporScoresService: RaporScoresService) {}

  /**
   * POST /rapor-scores
   * Membuat data rapor baru untuk seorang siswa.
   */
  @Post()
  create(@Body() createDto: CreateRaporScoreDto) {
    return this.raporScoresService.create(createDto);
  }

  /**
   * GET /rapor-scores
   * Mengambil seluruh data rapor, di-sort berdasarkan nilai_akhir tertinggi.
   */
  @Get()
  findAll() {
    return this.raporScoresService.findAll();
  }

  /**
   * GET /rapor-scores/:id
   * Mengambil satu data rapor berdasarkan ID.
   */
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.raporScoresService.findOne(id);
  }

  /**
   * PATCH /rapor-scores/:id
   * Memperbarui data rapor (partial update).
   * Secara otomatis menghitung ulang rata_rata dan nilai_akhir.
   */
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateRaporScoreDto,
  ) {
    return this.raporScoresService.update(id, updateDto);
  }

  /**
   * DELETE /rapor-scores/:id
   * Menghapus data rapor berdasarkan ID.
   */
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.raporScoresService.remove(id);
  }
}
