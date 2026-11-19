import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, Min } from 'class-validator';
import { Jurusan } from '../../../generated/prisma/client';

export class SetMajorQuotaDto {
  @IsEnum(Jurusan, {
    message: 'Pilihan jurusan tidak valid (pilihan: AK, ATP, DKV, TKJ, TKR)',
  })
  @IsNotEmpty({ message: 'Jurusan wajib dipilih' })
  jurusan!: Jurusan;

  @Type(() => Number)
  @IsInt({ message: 'Jumlah kuota harus berupa angka bulat' })
  @Min(0, { message: 'Jumlah kuota minimal 0' })
  quota!: number;
}
