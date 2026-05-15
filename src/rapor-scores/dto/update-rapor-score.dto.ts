import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateRaporScoreDto } from './create-rapor-score.dto';

// Omit id_student karena siswa tidak bisa diubah setelah data rapor dibuat
export class UpdateRaporScoreDto extends PartialType(
  OmitType(CreateRaporScoreDto, ['id_student'] as const),
) {}
