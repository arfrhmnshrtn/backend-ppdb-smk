import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { RegisterAdminAuthDto } from './dto/register-admin-auth.dto';
import { LoginAdminAuthDto } from './dto/login-admin-auth.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { OtpRateLimitGuard } from './guards/otp-rate-limit.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UseGuards(OtpRateLimitGuard)
  register(@Body() registerAuthDto: RegisterAuthDto) {
    return this.authService.register(registerAuthDto);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OtpRateLimitGuard)
  verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyOtp(verifyOtpDto);
  }

  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OtpRateLimitGuard)
  resendOtp(@Body() resendOtpDto: ResendOtpDto) {
    return this.authService.resendOtp(resendOtpDto);
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
