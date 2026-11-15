import { Test, TestingModule } from '@nestjs/testing';
import {
  BadGatewayException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { FonnteService } from './fonnte.service';

jest.mock('../lib/prisma.service', () => ({
  PrismaService: {},
}));

describe('AuthService – Registrasi & Verifikasi OTP WhatsApp', () => {
  let service: AuthService;
  let fonnteService: FonnteService;

  // In-memory mock store for Prisma
  const usersStore = new Map<
    number,
    {
      id: number;
      name: string | null;
      no_hp: string;
      username: string | null;
      password: string;
      role: 'USER' | 'ADMIN';
    }
  >();
  const otpStore = new Map<
    string,
    {
      id: string;
      phone_number: string;
      registration_data: {
        name: string;
        no_hp: string;
        password_hash: string;
      };
      otp_hash: string;
      expires_at: Date;
      attempts: number;
      resend_available_at: Date;
      verified_at: Date | null;
    }
  >();
  let nextUserId = 1;
  let lastSentOtp = '';
  let lastSentPhone = '';

  const mockPrisma = {
    user: {
      findFirst: jest.fn(
        async ({ where }: { where: { no_hp?: { in: string[] } } }) => {
          const list = where.no_hp?.in ?? [];
          for (const u of usersStore.values()) {
            if (list.includes(u.no_hp)) return u;
          }
          return null;
        },
      ),
      findUnique: jest.fn(
        async ({ where }: { where: { no_hp?: string; username?: string } }) => {
          for (const u of usersStore.values()) {
            if (where.no_hp && u.no_hp === where.no_hp) return u;
            if (where.username && u.username === where.username) return u;
          }
          return null;
        },
      ),
      create: jest.fn(
        async ({
          data,
        }: {
          data: {
            name: string;
            no_hp: string;
            username?: string;
            password: string;
            role?: 'USER' | 'ADMIN';
          };
        }) => {
          const created = {
            id: nextUserId++,
            name: data.name,
            no_hp: data.no_hp,
            username: data.username ?? null,
            password: data.password,
            role: data.role ?? 'USER',
          };
          usersStore.set(created.id, created);
          return created;
        },
      ),
    },
    registration_otps: {
      deleteMany: jest.fn(async () => ({ count: 0 })),
      findUnique: jest.fn(
        async ({ where }: { where: { phone_number: string } }) => {
          return otpStore.get(where.phone_number) ?? null;
        },
      ),
      upsert: jest.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: { phone_number: string };
          create: {
            phone_number: string;
            registration_data: {
              name: string;
              no_hp: string;
              password_hash: string;
            };
            otp_hash: string;
            expires_at: Date;
            attempts: number;
            resend_available_at: Date;
            verified_at: Date | null;
          };
          update: {
            registration_data: {
              name: string;
              no_hp: string;
              password_hash: string;
            };
            otp_hash: string;
            expires_at: Date;
            attempts: number;
            resend_available_at: Date;
            verified_at: Date | null;
          };
        }) => {
          const existing = otpStore.get(where.phone_number);
          const record = existing
            ? { ...existing, ...update }
            : { id: 'otp-1', ...create };
          otpStore.set(where.phone_number, record);
          return record;
        },
      ),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { phone_number: string };
          data: {
            attempts?: { increment: number } | number;
            verified_at?: Date | null;
            otp_hash?: string;
            expires_at?: Date;
            resend_available_at?: Date;
          };
        }) => {
          const existing = otpStore.get(where.phone_number);
          if (!existing) throw new Error('Record not found');
          const newAttempts =
            typeof data.attempts === 'object' && data.attempts !== null
              ? existing.attempts + data.attempts.increment
              : typeof data.attempts === 'number'
                ? data.attempts
                : existing.attempts;

          const updated = {
            ...existing,
            ...(data.otp_hash !== undefined ? { otp_hash: data.otp_hash } : {}),
            ...(data.expires_at !== undefined
              ? { expires_at: data.expires_at }
              : {}),
            ...(data.resend_available_at !== undefined
              ? { resend_available_at: data.resend_available_at }
              : {}),
            ...(data.verified_at !== undefined
              ? { verified_at: data.verified_at }
              : {}),
            attempts: newAttempts,
          };
          otpStore.set(where.phone_number, updated);
          return updated;
        },
      ),
    },
    $transaction: jest.fn(
      async <T>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
        return callback(mockPrisma);
      },
    ),
  };

  beforeEach(async () => {
    usersStore.clear();
    otpStore.clear();
    nextUserId = 1;
    lastSentOtp = '';
    lastSentPhone = '';
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('mock-jwt-token'),
          },
        },
        {
          provide: FonnteService,
          useValue: {
            sendOtpMessage: jest
              .fn()
              .mockImplementation(async (phone: string, otp: string) => {
                lastSentPhone = phone;
                lastSentOtp = otp;
              }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    fonnteService = module.get<FonnteService>(FonnteService);
    Object.defineProperty(service, 'prisma', { value: mockPrisma });
  });

  it('1 & 2 & 12. Registrasi dengan nomor WA valid mengirim OTP 4 digit via Fonnte dan belum membuat akun aktif', async () => {
    const res = await service.register({
      name: 'Budi Santoso',
      no_hp: '081234567890',
      password: 'password123',
    });

    expect(res.status).toBe(true);
    expect(res.data.no_hp).toBe('6281234567890');
    expect(fonnteService.sendOtpMessage).toHaveBeenCalledTimes(1);
    expect(lastSentPhone).toBe('6281234567890');
    expect(lastSentOtp).toMatch(/^\d{4}$/);

    // Pastikan OTP disimpan sebagai hash, bukan plaintext
    const storedOtp = otpStore.get('6281234567890');
    expect(storedOtp).toBeDefined();
    expect(storedOtp?.otp_hash).not.toBe(lastSentOtp);
    expect(await bcrypt.compare(lastSentOtp, storedOtp!.otp_hash)).toBe(true);

    // Pastikan akun belum dibuat sebelum OTP diverifikasi
    expect(usersStore.size).toBe(0);
  });

  it('3. Verifikasi menggunakan OTP yang benar membuat akun di database', async () => {
    await service.register({
      name: 'Budi Santoso',
      no_hp: '081234567890',
      password: 'password123',
    });

    const verifyRes = await service.verifyOtp({
      no_hp: '081234567890',
      otp: lastSentOtp,
    });

    expect(verifyRes.status).toBe(true);
    expect(verifyRes.data.no_hp).toBe('6281234567890');
    expect(usersStore.size).toBe(1);
    expect(otpStore.get('6281234567890')?.verified_at).not.toBeNull();
  });

  it('4. Verifikasi menggunakan OTP yang salah menambah attempts dan menampilkan sisa percobaan', async () => {
    await service.register({
      name: 'Budi Santoso',
      no_hp: '081234567890',
      password: 'password123',
    });

    const wrongOtp = lastSentOtp === '0000' ? '9999' : '0000';

    await expect(
      service.verifyOtp({
        no_hp: '081234567890',
        otp: wrongOtp,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(otpStore.get('6281234567890')?.attempts).toBe(1);
    expect(usersStore.size).toBe(0);
  });

  it('5. Verifikasi OTP yang sudah kedaluwarsa (> 5 menit) ditolak', async () => {
    await service.register({
      name: 'Budi Santoso',
      no_hp: '081234567890',
      password: 'password123',
    });

    const record = otpStore.get('6281234567890')!;
    otpStore.set('6281234567890', {
      ...record,
      expires_at: new Date(Date.now() - 1000),
    });

    await expect(
      service.verifyOtp({
        no_hp: '081234567890',
        otp: lastSentOtp,
      }),
    ).rejects.toThrow('Kode OTP sudah kedaluwarsa');
  });

  it('6. Verifikasi OTP yang sudah pernah digunakan ditolak', async () => {
    await service.register({
      name: 'Budi Santoso',
      no_hp: '081234567890',
      password: 'password123',
    });

    await service.verifyOtp({
      no_hp: '081234567890',
      otp: lastSentOtp,
    });

    await expect(
      service.verifyOtp({
        no_hp: '081234567890',
        otp: lastSentOtp,
      }),
    ).rejects.toThrow('Kode OTP sudah pernah digunakan');
  });

  it('7. Percobaan OTP lebih dari 5 kali ditolak', async () => {
    await service.register({
      name: 'Budi Santoso',
      no_hp: '081234567890',
      password: 'password123',
    });

    const wrongOtp = lastSentOtp === '0000' ? '9999' : '0000';

    for (let i = 0; i < 5; i++) {
      await expect(
        service.verifyOtp({
          no_hp: '081234567890',
          otp: wrongOtp,
        }),
      ).rejects.toThrow(BadRequestException);
    }

    expect(otpStore.get('6281234567890')?.attempts).toBe(5);

    // Percobaan ke-6 meskipun menggunakan OTP yang benar tetap ditolak
    await expect(
      service.verifyOtp({
        no_hp: '081234567890',
        otp: lastSentOtp,
      }),
    ).rejects.toThrow('Batas maksimal percobaan OTP (5 kali) telah habis');
  });

  it('8. Pengiriman ulang OTP sebelum cooldown 60 detik selesai ditolak', async () => {
    await service.register({
      name: 'Budi Santoso',
      no_hp: '081234567890',
      password: 'password123',
    });

    await expect(
      service.resendOtp({ no_hp: '081234567890' }),
    ).rejects.toThrow(/Silakan tunggu \d+ detik sebelum mengirim ulang OTP/);
  });

  it('9. Pengiriman ulang OTP setelah cooldown selesai menerbitkan OTP baru dan membatalkan OTP lama', async () => {
    await service.register({
      name: 'Budi Santoso',
      no_hp: '081234567890',
      password: 'password123',
    });

    const firstOtp = lastSentOtp;

    // Simulasikan cooldown 60 detik telah berlalu
    const record = otpStore.get('6281234567890')!;
    otpStore.set('6281234567890', {
      ...record,
      attempts: 3,
      resend_available_at: new Date(Date.now() - 1000),
    });

    // Pastikan OTP kedua berbeda untuk menguji pembatalan OTP pertama
    jest
      .spyOn(
        service as unknown as { generateOtp: () => string },
        'generateOtp',
      )
      .mockReturnValueOnce(firstOtp === '1234' ? '5678' : '1234');

    const resendRes = await service.resendOtp({ no_hp: '081234567890' });
    expect(resendRes.status).toBe(true);

    const secondOtp = lastSentOtp;
    expect(secondOtp).not.toBe(firstOtp);
    expect(otpStore.get('6281234567890')?.attempts).toBe(0);

    // OTP pertama tidak berlaku lagi
    await expect(
      service.verifyOtp({
        no_hp: '081234567890',
        otp: firstOtp,
      }),
    ).rejects.toThrow(BadRequestException);

    // OTP kedua berhasil diverifikasi
    const verifyRes = await service.verifyOtp({
      no_hp: '081234567890',
      otp: secondOtp,
    });
    expect(verifyRes.status).toBe(true);
  });

  it('10. Registrasi dengan nomor WhatsApp yang sudah digunakan ditolak', async () => {
    await service.register({
      name: 'Budi Santoso',
      no_hp: '081234567890',
      password: 'password123',
    });
    await service.verifyOtp({
      no_hp: '081234567890',
      otp: lastSentOtp,
    });

    await expect(
      service.register({
        name: 'User Lain',
        no_hp: '6281234567890',
        password: 'password456',
      }),
    ).rejects.toThrow('Nomor HP sudah terdaftar');
  });

  it('11. Kegagalan API Fonnte menggagalkan proses pengiriman OTP dan tidak menyimpan OTP', async () => {
    jest
      .spyOn(fonnteService, 'sendOtpMessage')
      .mockRejectedValueOnce(
        new BadGatewayException('Gagal mengirim pesan WhatsApp'),
      );

    await expect(
      service.register({
        name: 'Budi Santoso',
        no_hp: '081234567890',
        password: 'password123',
      }),
    ).rejects.toThrow(BadGatewayException);

    expect(otpStore.size).toBe(0);
    expect(usersStore.size).toBe(0);
  });
});
