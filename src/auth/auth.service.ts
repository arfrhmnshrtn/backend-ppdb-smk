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

  constructor(private jwtService: JwtService) {}

  // register user
  async register(registerAuthDto: RegisterAuthDto) {
    try {
      const { name, no_hp, password } = registerAuthDto;

      const existingUser = await this.prisma.user.findUnique({
        where: { no_hp },
      });
      if (existingUser) {
        throw new BadRequestException('Nomor HP sudah terdaftar');
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      await this.prisma.user.create({
        data: {
          name,
          no_hp,
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
      const { name, no_hp, password } = registerAuthDto;

      const existingUser = await this.prisma.user.findUnique({
        where: { no_hp },
      });
      if (existingUser) {
        throw new BadRequestException('Nomor HP sudah terdaftar');
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      await this.prisma.user.create({
        data: {
          name,
          no_hp,
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
      const user = await this.prisma.user.findUnique({
        where: {
          no_hp,
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
  async loginAdmin(loginAuthDto: LoginAuthDto) {
    try {
      const { no_hp, password } = loginAuthDto;
      const user = await this.prisma.user.findUnique({
        where: {
          no_hp,
        },
      });

      if (user?.role !== 'ADMIN') {
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
}
