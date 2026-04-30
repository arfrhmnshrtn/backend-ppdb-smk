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
  alamat!: string;

  @IsEnum(Jurusan)
  jurusan!: Jurusan;

}
