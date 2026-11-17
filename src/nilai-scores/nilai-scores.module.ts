import { Module } from '@nestjs/common';
import { NilaiScoresService } from './nilai-scores.service';
import { NilaiScoresController } from './nilai-scores.controller';
import { NilaiScoresExcelService } from './nilai-scores-excel.service';

@Module({
  controllers: [NilaiScoresController],
  providers: [NilaiScoresService, NilaiScoresExcelService],
  exports: [NilaiScoresService, NilaiScoresExcelService],
})
export class NilaiScoresModule {}
