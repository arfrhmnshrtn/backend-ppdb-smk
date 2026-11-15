import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { RegisterAuthDto } from './dto/register-auth.dto.js';
import { LoginAuthDto } from './dto/login-auth.dto.js';
import { RegisterAdminAuthDto } from './dto/register-admin-auth.dto.js';
import { LoginAdminAuthDto } from './dto/login-admin-auth.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() registerAuthDto: RegisterAuthDto) {
    return this.authService.register(registerAuthDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() loginAuthDto: LoginAuthDto) {
    return this.authService.login(loginAuthDto);
  }

  // register admin
  @Post('register-admin')
  registerAdmin(@Body() registerAdminAuthDto: RegisterAdminAuthDto) {
    return this.authService.registerAdmin(registerAdminAuthDto);
  }

  // login admin
  @Post('login-admin')
  @HttpCode(HttpStatus.OK)
  loginAdmin(@Body() loginAdminAuthDto: LoginAdminAuthDto) {
    return this.authService.loginAdmin(loginAdminAuthDto);
  }
}
