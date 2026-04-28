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

      if(user?.role !== 'USER') {
        throw new UnauthorizedException('Email atau password salah');
      }

      if (!user) {
        throw new UnauthorizedException('Email atau password salah');
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Email atau password salah');
      }

      const payload = { sub: user.id, email: user.email, role: user.role };
      const token = await this.jwtService.signAsync(payload);

      return {
        status: true,
        message: 'Login berhasil',
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
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
      const { email, password } = loginAuthDto;
      const user = await this.prisma.user.findUnique({
        where: {
          email,
        },
      });

      if(user?.role !== 'ADMIN') {
        throw new UnauthorizedException('Email atau password salah');
      }

      if (!user) {
        throw new UnauthorizedException('Email atau password salah');
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Email atau password salah');
      }

      const payload = { sub: user.id, email: user.email, role: user.role };
      const token = await this.jwtService.signAsync(payload);

      return {
        status: true,
        message: 'Login berhasil',
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
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
