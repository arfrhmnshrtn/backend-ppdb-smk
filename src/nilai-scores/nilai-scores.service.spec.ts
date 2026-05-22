import { Test, TestingModule } from '@nestjs/testing';
import { NilaiScoresService } from './nilai-scores.service';

describe('NilaiScoresService', () => {
  let service: NilaiScoresService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NilaiScoresService],
    }).compile();

    service = module.get<NilaiScoresService>(NilaiScoresService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
