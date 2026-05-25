import { IsOptional, IsEnum, IsInt, Min, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { Jurusan } from '../../../generated/prisma/client';

export enum RaporStatus {
  SUDAH = 'sudah',
  BELUM = 'belum',
}

export class QueryRaporStatusDto {
  @IsEnum(RaporStatus)
  status!: RaporStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(Jurusan)
  jurusan?: Jurusan;
}
