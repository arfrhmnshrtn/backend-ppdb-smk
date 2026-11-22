import { Transform } from 'class-transformer';
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { Jurusan } from '../../../generated/prisma/enums';

export class CreateUploadFileDto {
  @IsString()
  nama!: string;

  @IsString()
  no_hp!: string;

  @IsString()
  nisn!: string;

  @IsString()
  asal_sekolah!: string;

  @IsString()
  akreditasi_sekolah!: string;

  @IsString()
  alamat!: string;

  @IsOptional()
  @IsEnum(Jurusan, { message: 'Pilihan jurusan tidak valid' })
  jurusan?: Jurusan;

  @IsOptional()
  @IsEnum(Jurusan, { message: 'Jurusan pilihan 1 tidak valid' })
  jurusan_pilihan_1?: Jurusan;

  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === 'null' || value === null ? undefined : value,
  )
  @IsEnum(Jurusan, { message: 'Jurusan pilihan 2 tidak valid' })
  jurusan_pilihan_2?: Jurusan;
}
