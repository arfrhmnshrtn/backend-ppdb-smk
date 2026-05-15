import { Module } from '@nestjs/common';
import { RaporScoresController } from './rapor-scores.controller';
import { RaporScoresService } from './rapor-scores.service';

@Module({
  controllers: [RaporScoresController],
  providers: [RaporScoresService],
  exports: [RaporScoresService],
})
export class RaporScoresModule {}
