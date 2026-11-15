import {
  Injectable,
  UnauthorizedException,
  HttpException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../lib/prisma.service';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { RegisterAdminAuthDto } from './dto/register-admin-auth.dto';
import { LoginAdminAuthDto } from './dto/login-admin-auth.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { FonnteService } from './fonnte.service';
import {
  getPhoneVariants,
  normalizePhoneNumber,
} from './helpers/phone.helper';

export interface PendingRegistrationData {
  name: string;
  no_hp: string;
  password_hash: string;
}

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 menit
const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 60 detik
const OTP_MAX_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  private readonly prisma = PrismaService;

  constructor(
    private readonly jwtService: JwtService,
    private readonly fonnteService: FonnteService,
  ) {}

  private generateOtp(): string {
    return crypto.randomInt(0, 10000).toString().padStart(4, '0');
  }

  async cleanupExpiredOtps(): Promise<void> {
    await this.prisma.registration_otps.deleteMany({
      where: {
        expires_at: { lt: new Date() },
        verified_at: null,
      },
    });
  }

  // Tahap 1: Register user & kirim OTP WhatsApp via Fonnte
  async register(registerAuthDto: RegisterAuthDto) {
    try {
      const { name, no_hp, password } = registerAuthDto;
      const normalizedPhone = normalizePhoneNumber(no_hp);
      const phoneVariants = getPhoneVariants(normalizedPhone);

      const existingUser = await this.prisma.user.findFirst({
        where: {
          no_hp: { in: phoneVariants },
        },
      });
      if (existingUser) {
        throw new BadRequestException('Nomor HP sudah terdaftar');
      }

      await this.cleanupExpiredOtps();

      const now = new Date();
      const existingOtpRecord = await this.prisma.registration_otps.findUnique({
        where: { phone_number: normalizedPhone },
      });

      if (
        existingOtpRecord &&
        existingOtpRecord.verified_at === null &&
        existingOtpRecord.resend_available_at.getTime() > now.getTime()
      ) {
        const remainingSeconds = Math.ceil(
          (existingOtpRecord.resend_available_at.getTime() - now.getTime()) /
            1000,
        );
        throw new BadRequestException(
          `Silakan tunggu ${remainingSeconds} detik sebelum meminta kode OTP baru`,
        );
      }

      const otp = this.generateOtp();
      const [hashedPassword, otpHash] = await Promise.all([
        bcrypt.hash(password, 10),
        bcrypt.hash(otp, 10),
      ]);

      // Kirim OTP via Fonnte terlebih dahulu; jika gagal, exception akan dilempar
      await this.fonnteService.sendOtpMessage(normalizedPhone, otp, name);

      const registrationData: PendingRegistrationData = {
        name,
        no_hp: normalizedPhone,
        password_hash: hashedPassword,
      };

      const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MS);
      const resendAvailableAt = new Date(
        now.getTime() + OTP_RESEND_COOLDOWN_MS,
      );

      await this.prisma.registration_otps.upsert({
        where: { phone_number: normalizedPhone },
        create: {
          phone_number: normalizedPhone,
          registration_data: { ...registrationData },
          otp_hash: otpHash,
          expires_at: expiresAt,
          attempts: 0,
          resend_available_at: resendAvailableAt,
          verified_at: null,
        },
        update: {
          registration_data: { ...registrationData },
          otp_hash: otpHash,
          expires_at: expiresAt,
          attempts: 0,
          resend_available_at: resendAvailableAt,
          verified_at: null,
        },
      });

      return {
        status: true,
        message: 'Kode OTP telah dikirim ke nomor WhatsApp Anda',
        data: {
          no_hp: normalizedPhone,
          expires_in: OTP_EXPIRY_MS / 1000,
          resend_cooldown: OTP_RESEND_COOLDOWN_MS / 1000,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        status: false,
        message:
          'Pendaftaran gagal: ' +
          (error instanceof Error ? error.message : String(error)),
      });
    }
  }

  // Tahap 2: Verifikasi OTP & aktifkan/simpan akun ke tabel user
  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    try {
      const normalizedPhone = normalizePhoneNumber(verifyOtpDto.no_hp);
      const phoneVariants = getPhoneVariants(normalizedPhone);

      const otpRecord = await this.prisma.registration_otps.findUnique({
        where: { phone_number: normalizedPhone },
      });

      if (!otpRecord) {
        throw new BadRequestException(
          'Data registrasi tidak ditemukan. Silakan lakukan registrasi terlebih dahulu',
        );
      }

      if (otpRecord.verified_at !== null) {
        throw new BadRequestException('Kode OTP sudah pernah digunakan');
      }

      const existingUser = await this.prisma.user.findFirst({
        where: { no_hp: { in: phoneVariants } },
      });
      if (existingUser) {
        throw new BadRequestException('Nomor HP sudah terdaftar');
      }

      const now = new Date();
      if (otpRecord.expires_at.getTime() <= now.getTime()) {
        throw new BadRequestException(
          'Kode OTP sudah kedaluwarsa. Silakan kirim ulang OTP',
        );
      }

      if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
        throw new BadRequestException(
          'Batas maksimal percobaan OTP (5 kali) telah habis. Silakan kirim ulang OTP',
        );
      }

      const isOtpValid = await bcrypt.compare(
        verifyOtpDto.otp,
        otpRecord.otp_hash,
      );

      if (!isOtpValid) {
        const updatedRecord = await this.prisma.registration_otps.update({
          where: { phone_number: normalizedPhone },
          data: { attempts: { increment: 1 } },
        });

        const remainingAttempts = OTP_MAX_ATTEMPTS - updatedRecord.attempts;
        if (remainingAttempts <= 0) {
          throw new BadRequestException(
            'Kode OTP salah. Batas maksimal percobaan (5 kali) telah habis, silakan kirim ulang OTP',
          );
        }

        throw new BadRequestException(
          `Kode OTP salah. Sisa percobaan: ${remainingAttempts} kali`,
        );
      }

      const rawData =
        otpRecord.registration_data as unknown as PendingRegistrationData;

      const createdUser = await this.prisma.$transaction(async (tx) => {
        const duplicateCheck = await tx.user.findFirst({
          where: { no_hp: { in: phoneVariants } },
        });
        if (duplicateCheck) {
          throw new BadRequestException('Nomor HP sudah terdaftar');
        }

        await tx.registration_otps.update({
          where: { phone_number: normalizedPhone },
          data: { verified_at: now },
        });

        return tx.user.create({
          data: {
            name: rawData.name,
            no_hp: rawData.no_hp,
            password: rawData.password_hash,
            role: 'USER',
          },
        });
      });

      return {
        status: true,
        message: 'Pendaftaran berhasil',
        data: {
          id: createdUser.id,
          name: createdUser.name,
          no_hp: createdUser.no_hp,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        status: false,
        message:
          'Verifikasi OTP gagal: ' +
          (error instanceof Error ? error.message : String(error)),
      });
    }
  }

  // Kirim ulang OTP
  async resendOtp(resendOtpDto: ResendOtpDto) {
    try {
      const normalizedPhone = normalizePhoneNumber(resendOtpDto.no_hp);
      const phoneVariants = getPhoneVariants(normalizedPhone);

      const existingUser = await this.prisma.user.findFirst({
        where: { no_hp: { in: phoneVariants } },
      });
      if (existingUser) {
        throw new BadRequestException('Nomor HP sudah terdaftar');
      }

      const otpRecord = await this.prisma.registration_otps.findUnique({
        where: { phone_number: normalizedPhone },
      });

      if (!otpRecord) {
        throw new BadRequestException(
          'Data registrasi tidak ditemukan. Silakan lakukan registrasi terlebih dahulu',
        );
      }

      if (otpRecord.verified_at !== null) {
        throw new BadRequestException('Registrasi sudah diverifikasi');
      }

      const now = new Date();
      if (otpRecord.resend_available_at.getTime() > now.getTime()) {
        const remainingSeconds = Math.ceil(
          (otpRecord.resend_available_at.getTime() - now.getTime()) / 1000,
        );
        throw new BadRequestException(
          `Silakan tunggu ${remainingSeconds} detik sebelum mengirim ulang OTP`,
        );
      }

      const rawData =
        otpRecord.registration_data as unknown as PendingRegistrationData;
      const otp = this.generateOtp();
      const otpHash = await bcrypt.hash(otp, 10);

      await this.fonnteService.sendOtpMessage(
        normalizedPhone,
        otp,
        rawData.name,
      );

      const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MS);
      const resendAvailableAt = new Date(
        now.getTime() + OTP_RESEND_COOLDOWN_MS,
      );

      await this.prisma.registration_otps.update({
        where: { phone_number: normalizedPhone },
        data: {
          otp_hash: otpHash,
          expires_at: expiresAt,
          attempts: 0,
          resend_available_at: resendAvailableAt,
          verified_at: null,
        },
      });

      return {
        status: true,
        message: 'Kode OTP baru telah dikirim ke nomor WhatsApp Anda',
        data: {
          no_hp: normalizedPhone,
          expires_in: OTP_EXPIRY_MS / 1000,
          resend_cooldown: OTP_RESEND_COOLDOWN_MS / 1000,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        status: false,
        message:
          'Gagal mengirim ulang OTP: ' +
          (error instanceof Error ? error.message : String(error)),
      });
    }
  }

  // register admin
  async registerAdmin(registerAdminAuthDto: RegisterAdminAuthDto) {
    try {
      const { name, username, no_hp, password } = registerAdminAuthDto;
      const normalizedPhone = normalizePhoneNumber(no_hp);
      const phoneVariants = getPhoneVariants(normalizedPhone);

      const existingNoHp = await this.prisma.user.findFirst({
        where: { no_hp: { in: phoneVariants } },
      });
      if (existingNoHp) {
        throw new BadRequestException('Nomor HP sudah terdaftar');
      }

      const existingUsername = await this.prisma.user.findUnique({
        where: { username },
      });
      if (existingUsername) {
        throw new BadRequestException('Username sudah terdaftar');
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      await this.prisma.user.create({
        data: {
          name,
          username,
          no_hp: normalizedPhone,
          password: hashedPassword,
          role: 'ADMIN',
        },
      });

      return {
        status: true,
        message: 'Pendaftaran berhasil',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        status: false,
        message:
          'Pendaftaran gagal: ' +
          (error instanceof Error ? error.message : String(error)),
      });
    }
  }

  // login user
  async login(loginAuthDto: LoginAuthDto) {
    try {
      const { no_hp, password } = loginAuthDto;
      let phoneCandidates = [no_hp];
      try {
        const normalized = normalizePhoneNumber(no_hp);
        phoneCandidates = Array.from(
          new Set([no_hp, ...getPhoneVariants(normalized)]),
        );
      } catch {
        phoneCandidates = [no_hp];
      }

      const user = await this.prisma.user.findFirst({
        where: {
          no_hp: { in: phoneCandidates },
        },
      });

      if (user?.role !== 'USER') {
        throw new UnauthorizedException('Nomor HP atau password salah');
      }

      if (!user) {
        throw new UnauthorizedException('Nomor HP atau password salah');
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Nomor HP atau password salah');
      }

      const payload = { sub: user.id, no_hp: user.no_hp, role: user.role };
      const token = await this.jwtService.signAsync(payload);

      return {
        status: true,
        message: 'Login berhasil',
        data: {
          id: user.id,
          name: user.name,
          no_hp: user.no_hp,
          token,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        status: false,
        message:
          'Login gagal: ' +
          (error instanceof Error ? error.message : String(error)),
      });
    }
  }

  // login admin
  async loginAdmin(loginAdminAuthDto: LoginAdminAuthDto) {
    try {
      const { username, password } = loginAdminAuthDto;
      const user = await this.prisma.user.findUnique({
        where: {
          username,
        },
      });

      if (user?.role !== 'ADMIN') {
        throw new UnauthorizedException('Username atau password salah');
      }

      if (!user) {
        throw new UnauthorizedException('Username atau password salah');
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Username atau password salah');
      }

      const payload = {
        sub: user.id,
        username: user.username,
        no_hp: user.no_hp,
        role: user.role,
      };
      const token = await this.jwtService.signAsync(payload);

      return {
        status: true,
        message: 'Login berhasil',
        data: {
          id: user.id,
          name: user.name,
          username: user.username,
          no_hp: user.no_hp,
          token,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        status: false,
        message:
          'Login gagal: ' +
          (error instanceof Error ? error.message : String(error)),
      });
    }
  }
}
