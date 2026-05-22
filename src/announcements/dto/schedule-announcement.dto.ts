import { IsDateString, IsNotEmpty } from 'class-validator';

export class ScheduleAnnouncementDto {
  @IsNotEmpty({ message: 'published_at tidak boleh kosong' })
  @IsDateString({}, { message: 'published_at harus berupa format tanggal ISO 8601' })
  published_at!: string;
}
