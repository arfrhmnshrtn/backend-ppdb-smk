import { Test, TestingModule } from '@nestjs/testing';
import { NilaiScoresController } from './nilai-scores.controller';
import { NilaiScoresService } from './nilai-scores.service';

describe('NilaiScoresController', () => {
  let controller: NilaiScoresController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NilaiScoresController],
      providers: [NilaiScoresService],
    }).compile();

    controller = module.get<NilaiScoresController>(NilaiScoresController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
