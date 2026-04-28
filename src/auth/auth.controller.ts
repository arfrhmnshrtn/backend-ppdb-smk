import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { RegisterAuthDto } from './dto/register-auth.dto.js';
import { LoginAuthDto } from './dto/login-auth.dto.js';

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
  registerAdmin(@Body() registerAuthDto: RegisterAuthDto) {
    return this.authService.registerAdmin(registerAuthDto);
  }

  // login admin
  @Post('login-admin')
  @HttpCode(HttpStatus.OK)
  loginAdmin(@Body() loginAuthDto: LoginAuthDto) {
    return this.authService.loginAdmin(loginAuthDto);
  }
}
