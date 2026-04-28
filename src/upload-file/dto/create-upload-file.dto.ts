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

  @IsString()
  surat_keterangan_lulus!: string;

  @IsString()
  raport!: string;

  @IsOptional()
  @IsString()
  ktp_ayah?: string;

  @IsOptional()
  @IsString()
  ktp_ibu?: string;

  @IsString()
  kartu_keluarga!: string;

  @IsString()
  akta_kelahiran!: string;

  @IsString()
  pas_foto!: string;

  @IsString()
  sptjm!: string;

  @IsOptional()
  @IsString()
  kip?: string;

  @IsOptional()
  @IsString()
  paiagam?: string;

  @IsOptional()
  @IsString()
  sk_osis?: string;

  @IsOptional()
  @IsString()
  sk_pramuka?: string;
}
