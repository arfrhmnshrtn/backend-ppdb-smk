import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class RegisterAuthDto {
  @IsString()
  @IsNotEmpty({ message: 'Nama lengkap wajib diisi' })
  name!: string;

  @IsString()
  @IsNotEmpty({ message: 'Nomor WhatsApp wajib diisi' })
  @Matches(/^(?:\+?62|0)?8[1-9][0-9]{6,11}$/, {
    message:
      'Format nomor WhatsApp tidak valid. Gunakan format 08xxxxxxxxxx atau 628xxxxxxxxxx',
  })
  no_hp!: string;

  @IsString()
  @IsNotEmpty({ message: 'Password wajib diisi' })
  password!: string;
}
