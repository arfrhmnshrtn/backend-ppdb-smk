import { Test, TestingModule } from '@nestjs/testing';
import {
  BadGatewayException,
  BadRequestException,
} from '@nestjs/common';
import { ValidationsService } from './validations.service';
import { FonnteService } from '../auth/fonnte.service';
import {
  NotificationStatus,
  StatusDocument,
  VerificationStatus,
} from '../../generated/prisma/client';

jest.mock('../lib/prisma.service', () => ({
  PrismaService: {},
}));

interface MockDoc {
  id: string;
  id_student: number;
  id_document_type: number;
  status: StatusDocument;
  keterangan: string | null;
  updated_at: Date;
  document_type: { id: number; name: string };
}

interface MockNotification {
  id: string;
  id_student: number;
  phone_number: string;
  message: string;
  validation_summary: unknown;
  status: NotificationStatus;
  attempts: number;
  fonnte_response: string | null;
  sent_at: Date | null;
  last_attempt_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

describe('ValidationsService – Notifikasi WhatsApp Validasi Berkas PPDB', () => {
  let service: ValidationsService;
  let fonnteService: FonnteService;

  const docsStore = new Map<string, MockDoc>();
  const notificationsStore = new Map<string, MockNotification>();
  let nextNotifId = 1;
  let studentVerificationStatus: VerificationStatus =
    VerificationStatus.MENUNGGU_VALIDASI;
  let sentMessages: Array<{ phone: string; message: string }> = [];

  const mockStudent = {
    id: 10,
    id_user: 100,
    no_daftar: 'PPDB-2026-001',
    nama: 'Ahmad Fauzan',
    no_hp: '081111111111',
    user: {
      no_hp: '081298765432', // Nomor WhatsApp yang terverifikasi OTP saat registrasi
      name: 'Ahmad Fauzan',
    },
  };

  const mockPrisma = {
    documents: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        return docsStore.get(where.id) ?? null;
      }),
      findMany: jest.fn(
        async ({ where }: { where: { id_student: number } }) => {
          return Array.from(docsStore.values()).filter(
            (d) => d.id_student === where.id_student,
          );
        },
      ),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { status: StatusDocument; keterangan?: string | null };
        }) => {
          const existing = docsStore.get(where.id);
          if (!existing) throw new Error('Doc not found');
          const updated: MockDoc = {
            ...existing,
            status: data.status,
            keterangan: data.keterangan ?? null,
            updated_at: new Date(),
          };
          docsStore.set(where.id, updated);
          return updated;
        },
      ),
    },
    document_types: {
      count: jest.fn(async () => 5),
    },
    students: {
      findUnique: jest.fn(async ({ where }: { where: { id: number } }) => {
        if (where.id === mockStudent.id) return mockStudent;
        return null;
      }),
      update: jest.fn(
        async ({
          data,
        }: {
          where: { id: number };
          data: { verification_status: VerificationStatus };
        }) => {
          studentVerificationStatus = data.verification_status;
          return { ...mockStudent, verification_status: studentVerificationStatus };
        },
      ),
    },
    whatsapp_notifications: {
      create: jest.fn(
        async ({
          data,
        }: {
          data: {
            id_student: number;
            phone_number: string;
            message: string;
            validation_summary: unknown;
            status: NotificationStatus;
            attempts: number;
          };
        }) => {
          const id = `notif-${nextNotifId++}`;
          const now = new Date();
          const record: MockNotification = {
            id,
            id_student: data.id_student,
            phone_number: data.phone_number,
            message: data.message,
            validation_summary: data.validation_summary,
            status: data.status,
            attempts: data.attempts,
            fonnte_response: null,
            sent_at: null,
            last_attempt_at: null,
            created_at: now,
            updated_at: now,
          };
          notificationsStore.set(id, record);
          return record;
        },
      ),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: {
            phone_number?: string;
            status?: NotificationStatus;
            attempts?: number | { increment: number };
            fonnte_response?: string | null;
            sent_at?: Date | null;
            last_attempt_at?: Date | null;
          };
        }) => {
          const existing = notificationsStore.get(where.id);
          if (!existing) throw new Error('Notif not found');
          const attempts =
            typeof data.attempts === 'object' && data.attempts !== null
              ? existing.attempts + data.attempts.increment
              : typeof data.attempts === 'number'
                ? data.attempts
                : existing.attempts;
          const updated: MockNotification = {
            ...existing,
            ...(data.phone_number !== undefined
              ? { phone_number: data.phone_number }
              : {}),
            ...(data.status !== undefined ? { status: data.status } : {}),
            ...(data.fonnte_response !== undefined
              ? { fonnte_response: data.fonnte_response }
              : {}),
            ...(data.sent_at !== undefined ? { sent_at: data.sent_at } : {}),
            ...(data.last_attempt_at !== undefined
              ? { last_attempt_at: data.last_attempt_at }
              : {}),
            attempts,
            updated_at: new Date(),
          };
          notificationsStore.set(where.id, updated);
          return updated;
        },
      ),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        return notificationsStore.get(where.id) ?? null;
      }),
      findMany: jest.fn(async () => {
        return Array.from(notificationsStore.values()).map((n) => ({
          ...n,
          student: {
            id: mockStudent.id,
            no_daftar: mockStudent.no_daftar,
            nama: mockStudent.nama,
            jurusan: 'TKJ',
            verification_status: studentVerificationStatus,
          },
        }));
      }),
    },
    $transaction: jest.fn(async (operations: Array<Promise<unknown>>) => {
      return Promise.all(operations);
    }),
  };

  beforeEach(async () => {
    docsStore.clear();
    notificationsStore.clear();
    nextNotifId = 1;
    sentMessages = [];
    studentVerificationStatus = VerificationStatus.MENUNGGU_VALIDASI;
    jest.clearAllMocks();

    // Seed 5 initial PENDING documents for student 10
    const initialDocs: Array<{ id: string; name: string }> = [
      { id: 'doc-1', name: 'akta_kelahiran' },
      { id: 'doc-2', name: 'kartu_keluarga' },
      { id: 'doc-3', name: 'Ijazah' },
      { id: 'doc-4', name: 'KTP Orang Tua' },
      { id: 'doc-5', name: 'raport' },
    ];

    initialDocs.forEach((d, idx) => {
      docsStore.set(d.id, {
        id: d.id,
        id_student: 10,
        id_document_type: idx + 1,
        status: StatusDocument.PENDING,
        keterangan: null,
        updated_at: new Date(),
        document_type: { id: idx + 1, name: d.name },
      });
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ValidationsService,
        {
          provide: FonnteService,
          useValue: {
            sendWhatsAppMessage: jest
              .fn()
              .mockImplementation(async (phone: string, message: string) => {
                sentMessages.push({ phone, message });
                return { status: true, detail: 'success! message in queue' };
              }),
          },
        },
      ],
    }).compile();

    service = module.get<ValidationsService>(ValidationsService);
    fonnteService = module.get<FonnteService>(FonnteService);
    Object.defineProperty(service, 'prisma', { value: mockPrisma });
  });

  it('1 & 6 & 12. Ketika semua dokumen APPROVED: mengirim pesan bahwa semua dokumen telah diterima (tanpa daftar dokumen individual)', async () => {
    const res = await service.bulkValidateDocuments(10, {
      documents: [
        { document_id: 'doc-1', status: StatusDocument.APPROVED },
        { document_id: 'doc-2', status: StatusDocument.APPROVED },
        { document_id: 'doc-3', status: StatusDocument.APPROVED },
        { document_id: 'doc-4', status: StatusDocument.APPROVED },
        { document_id: 'doc-5', status: StatusDocument.APPROVED },
      ],
    });

    expect(res?.success).toBe(true);
    expect(sentMessages).toHaveLength(1);
    // Nomor WA terverifikasi milik user (081298765432 -> 6281298765432)
    expect(sentMessages[0].phone).toBe('6281298765432');
    expect(sentMessages[0].message).toContain('Nama: Ahmad Fauzan');
    expect(sentMessages[0].message).toContain(
      'Nomor Pendaftaran: PPDB-2026-001',
    );
    expect(sentMessages[0].message).toContain(
      'Selamat! Seluruh dokumen pendaftaran Anda telah berhasil divalidasi dan diterima (APPROVED).',
    );
    expect(sentMessages[0].message).not.toContain('Dokumen Diterima:');
    expect(res?.data.whatsapp_notification?.status).toBe(
      NotificationStatus.SENT,
    );
  });

  it('Dokumen setelah REVISI kemudian di-APPROVED: status berubah menjadi APPROVED (TERVERIFIKASI) dan mengirim pesan dokumen berhasil divalidasi', async () => {
    // 1. Awalnya doc-1 REVISI, doc-2..doc-5 APPROVED
    await service.bulkValidateDocuments(10, {
      documents: [
        {
          document_id: 'doc-1',
          status: StatusDocument.REVISI,
          keterangan: 'Perlu diperbaiki',
        },
        { document_id: 'doc-2', status: StatusDocument.APPROVED },
        { document_id: 'doc-3', status: StatusDocument.APPROVED },
        { document_id: 'doc-4', status: StatusDocument.APPROVED },
        { document_id: 'doc-5', status: StatusDocument.APPROVED },
      ],
    });

    expect(studentVerificationStatus).toBe(VerificationStatus.REVISI);
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0].message).toContain('Dokumen Perlu Diperbaiki:');

    // Tambahkan 1 dokumen opsional (sk_pramuka) berstatus PENDING yang tidak ikut dikirim dari form frontend
    docsStore.set('doc-6', {
      id: 'doc-6',
      id_student: 10,
      id_document_type: 6,
      status: StatusDocument.PENDING,
      keterangan: null,
      updated_at: new Date(),
      document_type: { id: 6, name: 'sk_pramuka' },
    });

    // 2. Setelah revisi, Admin mengubah doc-1 menjadi APPROVED
    const afterRevisiRes = await service.bulkValidateDocuments(10, {
      documents: [
        { document_id: 'doc-1', status: StatusDocument.APPROVED },
        { document_id: 'doc-2', status: StatusDocument.APPROVED },
        { document_id: 'doc-3', status: StatusDocument.APPROVED },
        { document_id: 'doc-4', status: StatusDocument.APPROVED },
        { document_id: 'doc-5', status: StatusDocument.APPROVED },
      ],
    });

    expect(afterRevisiRes?.success).toBe(true);
    expect(docsStore.get('doc-1')?.status).toBe(StatusDocument.APPROVED);
    expect(docsStore.get('doc-6')?.status).toBe(StatusDocument.APPROVED);
    expect(studentVerificationStatus).toBe(VerificationStatus.TERVERIFIKASI);
    expect(sentMessages).toHaveLength(2);
    expect(sentMessages[1].message).toContain(
      'Selamat! Seluruh dokumen pendaftaran Anda telah berhasil divalidasi dan diterima (APPROVED).',
    );
  });

  it('2 & 5. Dokumen berubah menjadi REVISI: WhatsApp terkirim beserta alasan revisi', async () => {
    const res = await service.validateDocument('doc-3', {
      status: StatusDocument.REVISI,
      keterangan:
        'Foto dokumen kurang jelas. Silakan upload ulang dengan kualitas yang lebih baik.',
    });

    expect(res?.success).toBe(true);
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0].message).toContain('Dokumen Perlu Diperbaiki:');
    expect(sentMessages[0].message).toContain('1. Ijazah - REVISI');
    expect(sentMessages[0].message).toContain(
      'Keterangan: Foto dokumen kurang jelas. Silakan upload ulang dengan kualitas yang lebih baik.',
    );
  });

  it('3 & 5. Dokumen berubah menjadi REJECTED: WhatsApp terkirim beserta alasan penolakan', async () => {
    const res = await service.validateDocument('doc-4', {
      status: StatusDocument.REJECTED,
      keterangan: 'Dokumen tidak sesuai dengan persyaratan.',
    });

    expect(res?.success).toBe(true);
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0].message).toContain('Dokumen Ditolak:');
    expect(sentMessages[0].message).toContain('1. KTP Orang Tua - REJECTED');
    expect(sentMessages[0].message).toContain(
      'Keterangan: Dokumen tidak sesuai dengan persyaratan.',
    );
  });

  it('4 & 5. Bulk validasi beberapa dokumen dengan status berbeda: hanya mencantumkan REVISI & REJECTED (dokumen APPROVED tidak tampil di pesan)', async () => {
    const res = await service.bulkValidateDocuments(10, {
      documents: [
        { document_id: 'doc-1', status: StatusDocument.APPROVED },
        { document_id: 'doc-2', status: StatusDocument.APPROVED },
        {
          document_id: 'doc-3',
          status: StatusDocument.REVISI,
          keterangan:
            'Foto dokumen kurang jelas. Silakan upload ulang dengan kualitas yang lebih baik.',
        },
        {
          document_id: 'doc-4',
          status: StatusDocument.REJECTED,
          keterangan: 'Dokumen tidak sesuai dengan persyaratan.',
        },
        { document_id: 'doc-5', status: StatusDocument.APPROVED },
      ],
    });

    expect(res?.success).toBe(true);
    expect(fonnteService.sendWhatsAppMessage).toHaveBeenCalledTimes(1);
    expect(sentMessages).toHaveLength(1);

    const msg = sentMessages[0].message;
    // Dokumen APPROVED tidak boleh muncul di dalam teks pesan
    expect(msg).not.toContain('Dokumen Diterima:');
    expect(msg).not.toContain('Akta Kelahiran');
    expect(msg).not.toContain('Kartu Keluarga');
    expect(msg).not.toContain('Rapor');

    // Hanya dokumen REVISI dan REJECTED yang muncul
    expect(msg).toContain('Dokumen Perlu Diperbaiki:');
    expect(msg).toContain('1. Ijazah - REVISI');
    expect(msg).toContain('Dokumen Ditolak:');
    expect(msg).toContain('1. KTP Orang Tua - REJECTED');
  });

  it('7 & 8. Kegagalan Fonnte tidak menggagalkan penyimpanan status dokumen dan mencatat status FAILED', async () => {
    jest
      .spyOn(fonnteService, 'sendWhatsAppMessage')
      .mockRejectedValueOnce(
        new BadGatewayException('Fonnte gateway unreachable'),
      );

    const res = await service.validateDocument('doc-3', {
      status: StatusDocument.REVISI,
      keterangan: 'Mohon perbaiki dokumen',
    });

    // Validasi dokumen tetap berhasil disimpan
    expect(res?.success).toBe(true);
    expect(docsStore.get('doc-3')?.status).toBe(StatusDocument.REVISI);

    // Notifikasi tercatat sebagai FAILED dengan attempts = 1
    expect(res?.data.whatsapp_notification?.status).toBe(
      NotificationStatus.FAILED,
    );
    expect(res?.data.whatsapp_notification?.attempts).toBe(1);
  });

  it('9 & 10. Admin dapat mengirim ulang notifikasi yang FAILED, dan notifikasi SENT tidak dapat dikirim ulang', async () => {
    // Pertama buat pengiriman gagal
    jest
      .spyOn(fonnteService, 'sendWhatsAppMessage')
      .mockRejectedValueOnce(new BadGatewayException('Timeout'));

    const valRes = await service.validateDocument('doc-3', {
      status: StatusDocument.REVISI,
      keterangan: 'File buram',
    });
    const notifId = valRes!.data.whatsapp_notification!.id;
    expect(valRes?.data.whatsapp_notification?.status).toBe(
      NotificationStatus.FAILED,
    );

    // Retry pengiriman oleh Admin -> berhasil
    const retryRes = await service.retryNotification(notifId);
    expect(retryRes?.success).toBe(true);
    expect(retryRes?.data.status).toBe(NotificationStatus.SENT);
    expect(retryRes?.data.attempts).toBe(2);

    // Coba retry lagi ketika status sudah SENT -> harus ditolak (mencegah duplikasi)
    await expect(service.retryNotification(notifId)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('11. Tidak mengirim notifikasi WhatsApp apabila status dokumen tidak berubah atau baru sebagian dokumen yang APPROVED', async () => {
    // Ubah 1 dokumen saja menjadi APPROVED (4 dokumen lain masih PENDING) -> belum semua APPROVED, tidak kirim pesan
    const partialApproveRes = await service.validateDocument('doc-1', {
      status: StatusDocument.APPROVED,
    });
    expect(partialApproveRes?.data.whatsapp_notification).toBeNull();
    expect(sentMessages).toHaveLength(0);

    // Ubah doc-3 menjadi REVISI pertama kali -> kirim 1 pesan
    await service.validateDocument('doc-3', {
      status: StatusDocument.REVISI,
      keterangan: 'Kurang jelas',
    });
    expect(sentMessages).toHaveLength(1);

    // Simpan ulang doc-3 dengan status yang sama (REVISI) -> tidak kirim pesan duplikat
    const secondRes = await service.validateDocument('doc-3', {
      status: StatusDocument.REVISI,
      keterangan: 'Kurang jelas',
    });

    expect(secondRes?.success).toBe(true);
    expect(secondRes?.data.whatsapp_notification).toBeNull();
    expect(sentMessages).toHaveLength(1);
  });
});
