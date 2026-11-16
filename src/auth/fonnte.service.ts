import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { normalizePhoneNumber } from './helpers/phone.helper';

export interface FonnteApiResponse {
  status?: boolean;
  detail?: string;
  reason?: string;
}

@Injectable()
export class FonnteService {
  private readonly endpoint = 'https://api.fonnte.com/send';
  private readonly timeoutMs = 15000;

  private getApiKey(): string {
    const token = (
      process.env.TOKEN_FONNTE ||
      process.env['TOKEN_FONNTE '] ||
      process.env.FONNTE_TOKEN ||
      process.env.FONNTE_API_KEY ||
      ''
    ).trim();

    if (!token) {
      throw new InternalServerErrorException(
        'Konfigurasi API Key Fonnte belum diatur pada environment server',
      );
    }

    return token;
  }

  async sendWhatsAppMessage(
    phoneNumber: string,
    message: string,
  ): Promise<FonnteApiResponse> {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    const token = this.getApiKey();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target: normalizedPhone,
          message,
          countryCode: '62',
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new BadGatewayException(
          `Gagal menghubungi layanan WhatsApp (HTTP ${response.status})`,
        );
      }

      const result = (await response.json()) as FonnteApiResponse;

      if (result.status === false) {
        const reason =
          result.reason || result.detail || 'Pengiriman pesan ditolak';
        if (
          reason.toLowerCase().includes('invalid') ||
          reason.toLowerCase().includes('target') ||
          reason.toLowerCase().includes('number')
        ) {
          throw new BadRequestException(
            `Nomor WhatsApp tidak valid atau tidak dapat menerima pesan: ${reason}`,
          );
        }
        throw new BadGatewayException(
          `Gagal mengirim pesan WhatsApp: ${reason}`,
        );
      }

      return {
        status: true,
        detail: result.detail || 'Pesan WhatsApp berhasil dikirim',
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof BadGatewayException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new ServiceUnavailableException(
          'Waktu koneksi ke layanan WhatsApp habis (timeout). Silakan coba lagi',
        );
      }

      throw new BadGatewayException(
        'Gagal mengirim pesan ke WhatsApp. Pastikan nomor aktif dan coba lagi',
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async sendOtpMessage(
    phoneNumber: string,
    otp: string,
    recipientName?: string,
  ): Promise<void> {
    const greeting = recipientName ? `Halo *${recipientName}*,` : 'Halo,';
    const message = [
      greeting,
      '',
      `Kode OTP registrasi PPDB SMK Anda adalah: *${otp}*`,
      '',
      'Kode ini berlaku selama *5 menit*. Jangan berikan kode ini kepada siapa pun.',
    ].join('\n');

    await this.sendWhatsAppMessage(phoneNumber, message);
  }
}
