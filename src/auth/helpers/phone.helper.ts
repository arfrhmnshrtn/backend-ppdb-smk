import { BadRequestException } from '@nestjs/common';

const INDONESIAN_WA_REGEX = /^628[1-9][0-9]{6,11}$/;

/**
 * Normalizes an Indonesian phone number to standard international format (628xxxxxxxxxx).
 * Throws BadRequestException if the number is invalid.
 */
export function normalizePhoneNumber(rawPhone: string): string {
  if (!rawPhone || typeof rawPhone !== 'string') {
    throw new BadRequestException('Nomor WhatsApp wajib diisi');
  }

  let cleaned = rawPhone.trim().replace(/[\s\-().]/g, '');

  if (cleaned.startsWith('+62')) {
    cleaned = '62' + cleaned.slice(3);
  } else if (cleaned.startsWith('08')) {
    cleaned = '62' + cleaned.slice(1);
  } else if (cleaned.startsWith('8')) {
    cleaned = '62' + cleaned;
  }

  if (!INDONESIAN_WA_REGEX.test(cleaned)) {
    throw new BadRequestException(
      'Format nomor WhatsApp tidak valid. Gunakan format 08xxxxxxxxxx atau 628xxxxxxxxxx',
    );
  }

  return cleaned;
}

/**
 * Returns both 628... and 08... variants of a normalized phone number
 * to prevent duplicate accounts across formats.
 */
export function getPhoneVariants(normalizedPhone: string): string[] {
  if (normalizedPhone.startsWith('62')) {
    return [normalizedPhone, '0' + normalizedPhone.slice(2)];
  }
  return [normalizedPhone];
}
