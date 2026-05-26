import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { NilaiScoresService } from './nilai-scores.service';
import { CreateNilaiScoreDto } from './dto/create-nilai-score.dto';
import { UpdateNilaiScoreDto } from './dto/update-nilai-score.dto';
import { QueryNilaiScoreDto } from './dto/query-nilai-score.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { user_role } from '../../generated/prisma/client';

@Controller('nilai-scores')
@UseGuards(AuthGuard, RolesGuard)
@Roles(user_role.ADMIN)
export class NilaiScoresController {
  constructor(private readonly nilaiScoresService: NilaiScoresService) {}

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
