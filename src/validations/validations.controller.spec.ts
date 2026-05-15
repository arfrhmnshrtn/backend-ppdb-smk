import { Test, TestingModule } from '@nestjs/testing';
import { ValidationsController } from './validations.controller';
import { ValidationsService } from './validations.service';

describe('ValidationsController', () => {
  let controller: ValidationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ValidationsController],
      providers: [ValidationsService],
    }).compile();

    controller = module.get<ValidationsController>(ValidationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
