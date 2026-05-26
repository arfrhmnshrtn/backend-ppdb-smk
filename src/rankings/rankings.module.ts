import { Module } from '@nestjs/common';
import { RankingsService } from './rankings.service';
import { RankingsController } from './rankings.controller';
import { JwtService } from '@nestjs/jwt';

@Module({
  controllers: [RankingsController],
  providers: [RankingsService, JwtService],
})
export class RankingsModule {}
