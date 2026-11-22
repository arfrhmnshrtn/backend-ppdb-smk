import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import {
  JalurPenerimaan,
  Jurusan,
  StatusAkhirSeleksi,
} from '../../../generated/prisma/client';

export class QueryRankingDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsEnum(Jurusan, { message: 'Jurusan tidak valid' })
  jurusan?: Jurusan;

  @IsOptional()
  @IsEnum(JalurPenerimaan, { message: 'Jalur penerimaan tidak valid' })
  jalur_penerimaan?: JalurPenerimaan;

  @IsOptional()
  @IsEnum(StatusAkhirSeleksi, { message: 'Status akhir seleksi tidak valid' })
  status_akhir?: StatusAkhirSeleksi;
}
