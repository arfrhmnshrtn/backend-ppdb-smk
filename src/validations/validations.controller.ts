import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ValidationsService } from './validations.service';
import { ValidateDocumentDto } from './dto/validate-document.dto';
import { BulkValidateDocumentsDto } from './dto/bulk-validate-documents.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { user_role } from '../../generated/prisma/client';

@Controller('validations')
@UseGuards(AuthGuard, RolesGuard)
export class ValidationsController {
  constructor(private readonly validationsService: ValidationsService) {}

  /**
   * Endpoint Admin untuk memvalidasi satu dokumen
   */
  @Patch('documents/:id')
  @Roles(user_role.ADMIN)
  async validateDocument(
    @Param('id') id: string,
    @Body() validateDocumentDto: ValidateDocumentDto,
  ) {
    return this.validationsService.validateDocument(id, validateDocumentDto);
  }

  /**
   * Endpoint Admin untuk memvalidasi banyak dokumen sekaligus (kolektif)
   */
  @Patch('students/:studentId/documents')
  @Roles(user_role.ADMIN)
  async bulkValidateDocuments(
    @Param('studentId', ParseIntPipe) studentId: number,
    @Body() bulkValidateDto: BulkValidateDocumentsDto,
  ) {
    return this.validationsService.bulkValidateDocuments(
      studentId,
      bulkValidateDto,
    );
  }

  /**
   * Endpoint Admin untuk melihat seluruh riwayat pengiriman notifikasi WhatsApp
   */
  @Get('notifications')
  @Roles(user_role.ADMIN)
  async getNotifications(@Query() query: QueryNotificationsDto) {
    return this.validationsService.getNotifications(query);
  }

  /**
   * Endpoint Admin untuk melihat riwayat pengiriman notifikasi WhatsApp per siswa
   */
  @Get('students/:studentId/notifications')
  @Roles(user_role.ADMIN)
  async getStudentNotifications(
    @Param('studentId', ParseIntPipe) studentId: number,
  ) {
    return this.validationsService.getStudentNotifications(studentId);
  }

  /**
   * Endpoint Admin untuk mengirim ulang notifikasi WhatsApp yang gagal (POST / PATCH)
   */
  @Post('notifications/:id/retry')
  @HttpCode(HttpStatus.OK)
  @Roles(user_role.ADMIN)
  async retryNotificationPost(@Param('id') id: string) {
    return this.validationsService.retryNotification(id);
  }

  @Patch('notifications/:id/retry')
  @Roles(user_role.ADMIN)
  async retryNotificationPatch(@Param('id') id: string) {
    return this.validationsService.retryNotification(id);
  }
}
