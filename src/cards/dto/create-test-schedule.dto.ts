import { IsDateString, IsString, IsNotEmpty } from 'class-validator';

export class CreateTestScheduleDto {
  @IsDateString()
  tanggal_test!: string;

  @IsString()
  @IsNotEmpty()
  jam_test!: string;

  @IsString()
  @IsNotEmpty()
  lokasi_test!: string;
}
