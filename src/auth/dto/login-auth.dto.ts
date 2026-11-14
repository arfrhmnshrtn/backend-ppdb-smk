import { IsNotEmpty, IsString } from 'class-validator';

export class LoginAuthDto {
  @IsString()
  @IsNotEmpty()
  no_hp!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
