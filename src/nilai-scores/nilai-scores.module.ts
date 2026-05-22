import { Module } from '@nestjs/common';
import { NilaiScoresService } from './nilai-scores.service';
import { NilaiScoresController } from './nilai-scores.controller';

@Module({
  controllers: [NilaiScoresController],
  providers: [NilaiScoresService],
})
export class NilaiScoresModule {}
