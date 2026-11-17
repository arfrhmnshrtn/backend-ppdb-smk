import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class ConfirmImportNilaiItemDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  row_number?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  student_id?: number;

  @IsString({ message: 'Kode PPDB (no_daftar) harus berupa teks' })
  @IsNotEmpty({ message: 'Kode PPDB (no_daftar) wajib diisi' })
  no_daftar!: string;

  @IsOptional()
  @IsString({ message: 'Nama siswa harus berupa teks' })
  nama?: string;

  @IsOptional()
  @IsString()
  jurusan?: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'Nilai Matematika harus berupa angka' })
  @Min(0, { message: 'Nilai Matematika minimal 0' })
  @Max(100, { message: 'Nilai Matematika maksimal 100' })
  math_score!: number;

  @Type(() => Number)
  @IsNumber({}, { message: 'Nilai Bahasa Indonesia harus berupa angka' })
  @Min(0, { message: 'Nilai Bahasa Indonesia minimal 0' })
  @Max(100, { message: 'Nilai Bahasa Indonesia maksimal 100' })
  indonesia_score!: number;

  @Type(() => Number)
  @IsNumber({}, { message: 'Nilai Bahasa Inggris harus berupa angka' })
  @Min(0, { message: 'Nilai Bahasa Inggris minimal 0' })
  @Max(100, { message: 'Nilai Bahasa Inggris maksimal 100' })
  english_score!: number;

  @Type(() => Number)
  @IsNumber({}, { message: 'Nilai Agama harus berupa angka' })
  @Min(0, { message: 'Nilai Agama minimal 0' })
  @Max(100, { message: 'Nilai Agama maksimal 100' })
  religion_score!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  average_score?: number;

  @IsOptional()
  @IsBoolean()
  is_update?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  previous_average_score?: number | null;
}

export class ConfirmImportNilaiDto {
  @IsOptional()
  @IsString()
  major?: string;

  @IsOptional()
  @IsString()
  jurusan?: string;

  @IsOptional()
  @IsArray({ message: 'items harus berupa array' })
  @ValidateNested({ each: true })
  @Type(() => ConfirmImportNilaiItemDto)
  items?: ConfirmImportNilaiItemDto[];

  @IsOptional()
  @IsArray({ message: 'valid_data harus berupa array' })
  @ValidateNested({ each: true })
  @Type(() => ConfirmImportNilaiItemDto)
  valid_data?: ConfirmImportNilaiItemDto[];

  @IsOptional()
  @IsArray({ message: 'validData harus berupa array' })
  @ValidateNested({ each: true })
  @Type(() => ConfirmImportNilaiItemDto)
  validData?: ConfirmImportNilaiItemDto[];

  @IsOptional()
  @IsArray({ message: 'data harus berupa array' })
  @ValidateNested({ each: true })
  @Type(() => ConfirmImportNilaiItemDto)
  data?: ConfirmImportNilaiItemDto[];
}
