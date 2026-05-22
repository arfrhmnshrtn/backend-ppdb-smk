import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { RegisterAuthDto } from './dto/register-auth.dto.js';
import { LoginAuthDto } from './dto/login-auth.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { AuthGuard } from './auth.guard.js';

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

  // refresh token
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refresh(refreshTokenDto.refresh_token);
  }

  // logout (revoke refresh token)
  @Post('logout')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  logout(@Request() req: any) {
    const userId = req.user.sub;
    return this.authService.logout(userId);
  }
}
