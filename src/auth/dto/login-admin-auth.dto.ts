import { IsNotEmpty, IsString } from 'class-validator';

export class LoginAdminAuthDto {
  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
