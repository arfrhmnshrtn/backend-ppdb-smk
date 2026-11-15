import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { FonnteService } from './fonnte.service';
import { OtpRateLimitGuard } from './guards/otp-rate-limit.guard';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'secretKey',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, FonnteService, OtpRateLimitGuard],
  exports: [AuthService, FonnteService],
})
export class AuthModule {}
