import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional } from 'class-validator';
import { NotificationStatus } from '../../../generated/prisma/client';

export class QueryNotificationsDto {
  @IsOptional()
  @IsEnum(NotificationStatus, {
    message: 'Status notifikasi harus PENDING, SENT, atau FAILED',
  })
  status?: NotificationStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'studentId harus berupa angka' })
  studentId?: number;
}
