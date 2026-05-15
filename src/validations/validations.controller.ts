import {
  Controller,
  Patch,
  Param,
  Body,
  UseGuards,
  BadRequestException,
  ParseIntPipe,
} from '@nestjs/common';
import { ValidationsService } from './validations.service';
import { ValidateDocumentDto } from './dto/validate-document.dto';
import { BulkValidateDocumentsDto } from './dto/bulk-validate-documents.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../../generated/prisma/client';


@Controller('validations')
@UseGuards(AuthGuard, RolesGuard)
export class ValidationsController {
  constructor(private readonly validationsService: ValidationsService) {}

  /**
   * Endpoint Admin untuk memvalidasi dokumen
   * Security:
   * - JwtAuthGuard: Memastikan user sudah login
   * - RolesGuard: Memastikan hanya ADMIN yang bisa akses
   * - Dto validation class-validator
   */
  @Patch('documents/:id')
  @Roles(Role.ADMIN)
  async validateDocument(
    @Param('id') id: string,
    @Body() validateDocumentDto: ValidateDocumentDto,
  ) {
    return this.validationsService.validateDocument(id, validateDocumentDto);
  }

  /**
   * Endpoint Admin untuk memvalidasi banyak dokumen sekaligus
   * Security:
   * - Transactional via Service
   * - Validasi studentId dan IDOR di service
   */
  @Patch('students/:studentId/documents')
  @Roles(Role.ADMIN)
  async bulkValidateDocuments(
    @Param('studentId', ParseIntPipe) studentId: number,
    @Body() bulkValidateDto: BulkValidateDocumentsDto,
  ) {
    return this.validationsService.bulkValidateDocuments(studentId, bulkValidateDto);
  }
  }

