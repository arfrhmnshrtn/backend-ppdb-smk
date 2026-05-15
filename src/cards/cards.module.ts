import { Module } from '@nestjs/common';
import { CardsController } from './cards.controller';
import { CardsService } from './cards.service';
import { PdfGeneratorService } from './pdf/pdf-generator.service';

@Module({
  controllers: [CardsController],
  providers: [CardsService, PdfGeneratorService],
  exports: [CardsService],
})
export class CardsModule {}
