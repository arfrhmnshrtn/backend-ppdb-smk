import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { NilaiScoresController } from './nilai-scores.controller';
import { NilaiScoresService } from './nilai-scores.service';
import { NilaiScoresExcelService } from './nilai-scores-excel.service';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { user_role } from '../../generated/prisma/client';

describe('NilaiScoresController', () => {
  let controller: NilaiScoresController;

  const mockNilaiScoresService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findScoreStatus: jest.fn(),
    findByStudentId: jest.fn(),
    findAllByJurusan: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockNilaiScoresExcelService = {
    generateTemplateExcel: jest.fn(),
    parseAndPreviewExcel: jest.fn(),
    confirmImportNilai: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NilaiScoresController],
      providers: [
        {
          provide: NilaiScoresService,
          useValue: mockNilaiScoresService,
        },
        {
          provide: NilaiScoresExcelService,
          useValue: mockNilaiScoresExcelService,
        },
        {
          provide: JwtService,
          useValue: { verifyAsync: jest.fn() },
        },
        Reflector,
      ],
    }).compile();

    controller = module.get<NilaiScoresController>(NilaiScoresController);
  });

  it('should be defined and restricted to ADMIN role', () => {
    expect(controller).toBeDefined();
    const roles = Reflect.getMetadata(ROLES_KEY, NilaiScoresController);
    expect(roles).toEqual([user_role.ADMIN]);
  });
});
