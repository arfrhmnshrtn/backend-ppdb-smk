import {
  Controller,
  Post,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RankingsService } from './rankings.service';
import { QueryRankingDto } from './dto/query-ranking.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { user_role } from '../../generated/prisma/client';

@Controller('rankings')
@UseGuards(AuthGuard, RolesGuard)
@Roles(user_role.ADMIN)
export class RankingsController {
  constructor(private readonly rankingsService: RankingsService) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  async generateRanking() {
    return this.rankingsService.generateRanking();
  }

  @Post('seleksi')
  @HttpCode(HttpStatus.OK)
  async runSelectionProcess() {
    return this.rankingsService.runSelectionProcess();
  }

  @Get('seleksi')
  async getSelectionResults(@Query() query: QueryRankingDto) {
    return this.rankingsService.getSelectionResults(query);
  }

  @Get()
  async getRankings(@Query() query: QueryRankingDto) {
    return this.rankingsService.getRankings(query);
  }
}
