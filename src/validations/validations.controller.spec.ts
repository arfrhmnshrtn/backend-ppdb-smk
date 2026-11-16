import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { ValidationsController } from './validations.controller';
import { ValidationsService } from './validations.service';

describe('ValidationsController', () => {
  let controller: ValidationsController;

  const mockValidationsService = {
    validateDocument: jest.fn(),
    bulkValidateDocuments: jest.fn(),
    getNotifications: jest.fn(),
    getStudentNotifications: jest.fn(),
    retryNotification: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ValidationsController],
      providers: [
        {
          provide: ValidationsService,
          useValue: mockValidationsService,
        },
        {
          provide: JwtService,
          useValue: { verifyAsync: jest.fn() },
        },
        Reflector,
      ],
    }).compile();

    controller = module.get<ValidationsController>(ValidationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
