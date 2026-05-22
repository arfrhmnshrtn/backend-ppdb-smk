import {
  HttpStatus,
  Injectable,
  UnauthorizedException,
  HttpException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { RegisterAuthDto } from './dto/register-auth.dto.js';
import { PrismaService } from '../lib/prisma.service.js';
import { LoginAuthDto } from './dto/login-auth.dto.js';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  private readonly prisma = PrismaService;

  constructor(private jwtService: JwtService) { }

  // register user
  async register(registerAuthDto: RegisterAuthDto) {
    try {
      const { name, email, password } = registerAuthDto;

      const existingUser = await this.prisma.user.findUnique({
        where: { email },
      });
      if (existingUser) {
        throw new BadRequestException('Email sudah terdaftar');
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      await this.prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
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

  // register admin
  async registerAdmin(registerAuthDto: RegisterAuthDto) {
    try {
      const { name, email, password } = registerAuthDto;

      const existingUser = await this.prisma.user.findUnique({
        where: { email },
      });
      if (existingUser) {
        throw new BadRequestException('Email sudah terdaftar');
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      await this.prisma.user.create({
        data: {
          name,
          email,
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
      const { email, password } = loginAuthDto;
      const user = await this.prisma.user.findUnique({
        where: {
          email,
        },
      });

      if (user?.role !== 'USER') {
        throw new UnauthorizedException('Email atau password salah');
      }

      if (!user) {
        throw new UnauthorizedException('Email atau password salah');
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Email atau password salah');
      }

      const tokens = await this.generateTokens(user.id, user.email, user.role);
      await this.updateRefreshToken(user.id, tokens.refreshToken);

      return {
        status: true,
        message: 'Login berhasil',
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          token: tokens.accessToken,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
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
  async loginAdmin(loginAuthDto: LoginAuthDto) {
    try {
      const { email, password } = loginAuthDto;
      const user = await this.prisma.user.findUnique({
        where: {
          email,
        },
      });

      if (user?.role !== 'ADMIN') {
        throw new UnauthorizedException('Email atau password salah');
      }

      if (!user) {
        throw new UnauthorizedException('Email atau password salah');
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Email atau password salah');
      }

      const tokens = await this.generateTokens(user.id, user.email, user.role);
      await this.updateRefreshToken(user.id, tokens.refreshToken);

      return {
        status: true,
        message: 'Login berhasil',
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          token: tokens.accessToken,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
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

  // Helper: Generate Access and Refresh Tokens
  async generateTokens(userId: number, email: string, role: string) {
    const payload = { sub: userId, email, role };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_SECRET || 'secretKey',
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET || 'refreshSecretKey',
        expiresIn: '7d',
      }),
    ]);

    return { accessToken, refreshToken };
  }

  // Helper: Update user's hashed refresh token in database
  async updateRefreshToken(userId: number, refreshToken: string | null) {
    const hashedToken = refreshToken ? await bcrypt.hash(refreshToken, 10) : null;
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hashedToken },
    });
  }

  // Verify and process refresh token request
  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || 'refreshSecretKey',
      });

      const userId = payload.sub;
      return this.refreshTokens(userId, refreshToken);
    } catch (error) {
      throw new UnauthorizedException('Token refresh tidak valid atau kedaluwarsa');
    }
  }

  // Inner refresh logic after token payload extraction
  private async refreshTokens(userId: number, refreshToken: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Akses ditolak atau token tidak valid');
    }

    const isTokenMatch = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isTokenMatch) {
      throw new UnauthorizedException('Akses ditolak atau token tidak valid');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      status: true,
      message: 'Token berhasil diperbarui',
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    };
  }

  // Logout user (revoke token)
  async logout(userId: number) {
    await this.updateRefreshToken(userId, null);
    return {
      status: true,
      message: 'Logout berhasil',
    };
  }
}
