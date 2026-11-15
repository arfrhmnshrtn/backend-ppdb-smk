import { IsNotEmpty, IsString } from 'class-validator';

export class ResendOtpDto {
  @IsString()
  @IsNotEmpty({ message: 'Nomor WhatsApp wajib diisi' })
  no_hp!: string;
}
