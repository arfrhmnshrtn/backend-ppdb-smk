import { IsInt, Min, Max, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateNilaiScoreDto {
  @IsNotEmpty()
  @IsInt()
  @Type(() => Number)
  student_id!: number;

  @IsNotEmpty()
  @IsInt()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  math_score!: number;

  @IsNotEmpty()
  @IsInt()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  indonesia_score!: number;

  @IsNotEmpty()
  @IsInt()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  english_score!: number;

  @IsNotEmpty()
  @IsInt()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  religion_score!: number;
}
