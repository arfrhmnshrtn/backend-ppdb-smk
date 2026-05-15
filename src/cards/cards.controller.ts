import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  UseGuards,
  Req,
  Res,
  Body,
  Param,
  ParseIntPipe,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import { CardsService } from './cards.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { user_role } from '../../generated/prisma/client';
import { CreateTestScheduleDto } from './dto/create-test-schedule.dto';

/**
 * Controller untuk kartu pendaftaran PPDB dan jadwal test.
 * - Endpoint /cards/me* → untuk siswa (USER)
 * - Endpoint /cards/test-schedules* → untuk admin (ADMIN)
 */
@Controller('cards')
@UseGuards(AuthGuard, RolesGuard)
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  // ==================== SISWA: Kartu Pendaftaran ====================

  /**
   * GET /cards/me
   * Melihat data kartu pendaftaran milik siswa yang sedang login.
   */
  @Get('me')
  @Roles(user_role.USER)
  getMyCard(@Req() req: { user: { sub: number } }) {
    return this.cardsService.getMyCard(req.user.sub);
  }

  /**
   * GET /cards/me/download
   * Download kartu pendaftaran dalam format PDF.
   */
  @Get('me/download')
  @Roles(user_role.USER)
  async downloadMyCard(
    @Req() req: { user: { sub: number } },
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, filename } = await this.cardsService.downloadMyCard(
      req.user.sub,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });

    return new StreamableFile(buffer);
  }

  // ==================== ADMIN: CRUD Jadwal Test ====================

  /**
   * POST /cards/test-schedules
   * Membuat jadwal test baru.
   */
  @Post('test-schedules')
  @Roles(user_role.ADMIN)
  createTestSchedule(@Body() dto: CreateTestScheduleDto) {
    return this.cardsService.createTestSchedule(dto);
  }

  /**
   * GET /cards/test-schedules
   * Mengambil seluruh jadwal test.
   */
  @Get('test-schedules')
  @Roles(user_role.ADMIN)
  findAllTestSchedules() {
    return this.cardsService.findAllTestSchedules();
  }

  /**
   * PATCH /cards/test-schedules/:id
   * Memperbarui jadwal test berdasarkan ID.
   */
  @Patch('test-schedules/:id')
  @Roles(user_role.ADMIN)
  updateTestSchedule(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateTestScheduleDto,
  ) {
    return this.cardsService.updateTestSchedule(id, dto);
  }

  /**
   * DELETE /cards/test-schedules/:id
   * Menghapus jadwal test berdasarkan ID.
   */
  @Delete('test-schedules/:id')
  @Roles(user_role.ADMIN)
  removeTestSchedule(@Param('id', ParseIntPipe) id: number) {
    return this.cardsService.removeTestSchedule(id);
  }
}

