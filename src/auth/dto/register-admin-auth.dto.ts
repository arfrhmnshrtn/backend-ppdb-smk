import { IsNotEmpty, IsString } from 'class-validator';

export class RegisterAdminAuthDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @IsNotEmpty()
  no_hp!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
