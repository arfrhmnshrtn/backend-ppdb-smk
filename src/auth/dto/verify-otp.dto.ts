import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @IsNotEmpty({ message: 'Nomor WhatsApp wajib diisi' })
  no_hp!: string;

  @IsString()
  @IsNotEmpty({ message: 'Kode OTP wajib diisi' })
  @Length(4, 4, { message: 'Kode OTP harus terdiri dari 4 digit' })
  @Matches(/^\d{4}$/, { message: 'Kode OTP harus berupa 4 digit angka' })
  otp!: string;
}
