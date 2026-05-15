import { IsInt, IsNumber, Min, Max } from 'class-validator';

export class CreateRaporScoreDto {
  @IsInt()
  id_student!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  semester_1!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  semester_2!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  semester_3!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  semester_4!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  semester_5!: number;

  @IsInt()
  @Min(0)
  @Max(10)
  prestasi!: number;
}
