import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';

interface RateLimitBucket {
  timestamps: number[];
}

@Injectable()
export class OtpRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, RateLimitBucket>();
  private readonly windowMs = 60 * 1000; // 1 minute
  private readonly maxRequests = 10; // max 10 requests per minute per IP + route

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const ip =
      (typeof request.headers['x-forwarded-for'] === 'string'
        ? request.headers['x-forwarded-for'].split(',')[0].trim()
        : request.ip) || 'unknown';
    const path = request.route?.path || request.url || 'otp';
    const key = `${ip}:${path}`;

    const now = Date.now();
    const bucket = this.buckets.get(key) ?? { timestamps: [] };

    bucket.timestamps = bucket.timestamps.filter(
      (timestamp) => now - timestamp < this.windowMs,
    );

    if (bucket.timestamps.length >= this.maxRequests) {
      throw new HttpException(
        'Terlalu banyak permintaan OTP. Silakan tunggu beberapa saat sebelum mencoba kembali.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    bucket.timestamps.push(now);
    this.buckets.set(key, bucket);
    return true;
  }

  clear(): void {
    this.buckets.clear();
  }
}
