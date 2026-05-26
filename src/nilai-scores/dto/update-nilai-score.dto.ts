import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateNilaiScoreDto } from './create-nilai-score.dto';

// We omit student_id so that admin cannot change the student_id during update.
export class UpdateNilaiScoreDto extends PartialType(
  OmitType(CreateNilaiScoreDto, ['student_id'] as const),
) {}
