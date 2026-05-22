import { Controller, Post, Get, Query, UseGuards } from '@nestjs/common';
import { RankingsService } from './rankings.service';
import { QueryRankingDto } from './dto/query-ranking.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { user_role } from '../../generated/prisma/client';

@Controller('rankings')
export class RankingsController {
  constructor(private readonly rankingsService: RankingsService) {}

  @Post('generate')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(user_role.ADMIN)
  async generateRanking() {
    return this.rankingsService.generateRanking();
  }

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(user_role.ADMIN)
  async getRankings(@Query() query: QueryRankingDto) {
    return this.rankingsService.getRankings(query);
  }
}
