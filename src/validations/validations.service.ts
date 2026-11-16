import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ValidateDocumentDto } from './dto/validate-document.dto';
import { BulkValidateDocumentsDto } from './dto/bulk-validate-documents.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { PrismaService } from '../lib/prisma.service';
import {
  NotificationStatus,
  StatusDocument,
  VerificationStatus,
} from '../../generated/prisma/client';
import { FonnteService } from '../auth/fonnte.service';
import { normalizePhoneNumber } from '../auth/helpers/phone.helper';
import {
  buildValidationWhatsAppMessage,
  formatDocumentTypeName,
  groupValidatedDocuments,
  ValidatedDocumentSummaryItem,
} from './helpers/validation-message.helper';

export const MAX_NOTIFICATION_ATTEMPTS = 5;

export interface NotificationResultSummary {
  id: string;
  id_student: number;
  phone_number: string;
  status: NotificationStatus;
  attempts: number;
  fonnte_response: string | null;
  sent_at: Date | null;
  last_attempt_at: Date | null;
}

const OPTIONAL_DOCUMENT_TYPES = new Set([
  'kip',
  'paiagam',
  'sk_osis',
  'sk_pramuka',
]);

@Injectable()
export class ValidationsService {
  private readonly prisma = PrismaService;

  constructor(private readonly fonnteService: FonnteService) {}

  private isNotifiableStatus(status: StatusDocument): boolean {
    return (
      status === StatusDocument.APPROVED ||
      status === StatusDocument.REVISI ||
      status === StatusDocument.REJECTED
    );
  }

  private async areAllStudentDocumentsApproved(
    studentId: number,
  ): Promise<boolean> {
    const studentDocs = await this.prisma.documents.findMany({
      where: { id_student: studentId },
    });

    if (studentDocs.length === 0) {
      return false;
    }

    return studentDocs.every((doc) => doc.status === StatusDocument.APPROVED);
  }

  /**
   * Mengirim notifikasi WhatsApp secara kolektif dan mencatat riwayat ke database.
   * - Jika allApproved = true: mengirim pesan bahwa semua dokumen telah diterima.
   * - Jika allApproved = false: hanya mencantumkan dokumen yang REVISI atau REJECTED.
   * Kegagalan pengiriman WhatsApp tidak akan melempar exception agar status dokumen tetap tersimpan.
   */
  async sendValidationNotification(
    studentId: number,
    changedItems: ValidatedDocumentSummaryItem[],
    allApproved = false,
  ): Promise<NotificationResultSummary | null> {
    const issueItems = changedItems.filter(
      (item) =>
        item.status === StatusDocument.REVISI ||
        item.status === StatusDocument.REJECTED,
    );

    if (!allApproved && issueItems.length === 0) {
      return null;
    }

    try {
      const student = await this.prisma.students.findUnique({
        where: { id: studentId },
        include: {
          user: {
            select: {
              no_hp: true,
              name: true,
            },
          },
        },
      });

      if (!student) {
        return null;
      }

      // Gunakan nomor WhatsApp dari akun user yang telah terverifikasi OTP
      const rawPhone = student.user?.no_hp || student.no_hp;
      let targetPhone = rawPhone;
      let phoneValidationError: string | null = null;

      try {
        targetPhone = normalizePhoneNumber(rawPhone);
      } catch (err) {
        phoneValidationError =
          err instanceof Error
            ? err.message
            : 'Format nomor WhatsApp tidak valid';
      }

      const message = buildValidationWhatsAppMessage(
        student.nama,
        student.no_daftar,
        issueItems,
        allApproved,
      );
      const summaryPayload = groupValidatedDocuments(issueItems, allApproved);

      // 1. Buat record riwayat dengan status awal PENDING
      const notificationRecord =
        await this.prisma.whatsapp_notifications.create({
          data: {
            id_student: student.id,
            phone_number: targetPhone,
            message,
            validation_summary: JSON.parse(JSON.stringify(summaryPayload)),
            status: NotificationStatus.PENDING,
            attempts: 0,
          },
        });

      const attemptTime = new Date();

      // Jika nomor tidak valid sebelum memanggil Fonnte, langsung catat FAILED
      if (phoneValidationError) {
        const failedRecord = await this.prisma.whatsapp_notifications.update({
          where: { id: notificationRecord.id },
          data: {
            status: NotificationStatus.FAILED,
            attempts: 1,
            fonnte_response: phoneValidationError,
            last_attempt_at: attemptTime,
          },
        });

        return {
          id: failedRecord.id,
          id_student: failedRecord.id_student,
          phone_number: failedRecord.phone_number,
          status: failedRecord.status,
          attempts: failedRecord.attempts,
          fonnte_response: failedRecord.fonnte_response,
          sent_at: failedRecord.sent_at,
          last_attempt_at: failedRecord.last_attempt_at,
        };
      }

      // 2. Kirim pesan ke Fonnte
      try {
        const fonnteRes = await this.fonnteService.sendWhatsAppMessage(
          targetPhone,
          message,
        );

        const sentRecord = await this.prisma.whatsapp_notifications.update({
          where: { id: notificationRecord.id },
          data: {
            status: NotificationStatus.SENT,
            attempts: 1,
            fonnte_response: fonnteRes.detail || 'Pesan WhatsApp terkirim',
            sent_at: attemptTime,
            last_attempt_at: attemptTime,
          },
        });

        return {
          id: sentRecord.id,
          id_student: sentRecord.id_student,
          phone_number: sentRecord.phone_number,
          status: sentRecord.status,
          attempts: sentRecord.attempts,
          fonnte_response: sentRecord.fonnte_response,
          sent_at: sentRecord.sent_at,
          last_attempt_at: sentRecord.last_attempt_at,
        };
      } catch (sendError) {
        const errorReason =
          sendError instanceof Error
            ? sendError.message
            : 'Gagal mengirim pesan melalui Fonnte';

        const failedRecord = await this.prisma.whatsapp_notifications.update({
          where: { id: notificationRecord.id },
          data: {
            status: NotificationStatus.FAILED,
            attempts: 1,
            fonnte_response: errorReason,
            last_attempt_at: attemptTime,
          },
        });

        return {
          id: failedRecord.id,
          id_student: failedRecord.id_student,
          phone_number: failedRecord.phone_number,
          status: failedRecord.status,
          attempts: failedRecord.attempts,
          fonnte_response: failedRecord.fonnte_response,
          sent_at: failedRecord.sent_at,
          last_attempt_at: failedRecord.last_attempt_at,
        };
      }
    } catch (unexpectedError) {
      console.error(
        'Error saat memproses notifikasi WhatsApp validasi:',
        unexpectedError,
      );
      return null;
    }
  }

  /**
   * Method untuk admin memvalidasi satu dokumen
   */
  async validateDocument(id: string, validateDocumentDto: ValidateDocumentDto) {
    try {
      const { status, keterangan } = validateDocumentDto;

      // 1. Pastikan dokumen exists beserta relasi jenis dokumen & status siswa saat ini
      const existingDocument = await this.prisma.documents.findUnique({
        where: { id },
        include: {
          document_type: true,
          student: {
            select: {
              verification_status: true,
            },
          },
        },
      });

      if (!existingDocument) {
        throw new NotFoundException('Dokumen tidak ditemukan');
      }

      const previousVerificationStatus =
        existingDocument.student?.verification_status;

      // 2. Logic: jika status APPROVED, keterangan dikosongkan (otomatis null)
      let finalKeterangan: string | null | undefined = keterangan;
      if (status === StatusDocument.APPROVED) {
        finalKeterangan = null;
      }

      const hasStatusChanged =
        existingDocument.status !== status && this.isNotifiableStatus(status);

      // 3. Update status dokumen
      const updatedDocument = await this.prisma.documents.update({
        where: { id },
        data: {
          status,
          keterangan: finalKeterangan,
        },
        select: {
          id: true,
          id_student: true,
          status: true,
          keterangan: true,
          updated_at: true,
        },
      });

      // Jika dokumen diubah menjadi APPROVED, periksa apakah dokumen wajib lainnya sudah APPROVED
      // dan hanya tersisa dokumen opsional yang masih PENDING
      if (status === StatusDocument.APPROVED) {
        const allStudentDocs = await this.prisma.documents.findMany({
          where: { id_student: updatedDocument.id_student },
          include: { document_type: true },
        });

        const hasRevisiOrRejected = allStudentDocs.some(
          (d) =>
            d.status === StatusDocument.REVISI ||
            d.status === StatusDocument.REJECTED,
        );
        const pendingDocs = allStudentDocs.filter(
          (d) => d.status === StatusDocument.PENDING,
        );
        const allPendingAreOptional =
          pendingDocs.length > 0 &&
          pendingDocs.every((d) =>
            OPTIONAL_DOCUMENT_TYPES.has(
              d.document_type.name.trim().toLowerCase(),
            ),
          );

        if (!hasRevisiOrRejected && allPendingAreOptional) {
          await Promise.all(
            pendingDocs.map((d) =>
              this.prisma.documents.update({
                where: { id: d.id },
                data: { status: StatusDocument.APPROVED, keterangan: null },
              }),
            ),
          );
        }
      }

      // 4. Update status verifikasi siswa secara otomatis
      const newVerificationStatus = await this.updateStudentVerificationStatus(
        updatedDocument.id_student,
      );

      // 5. Kirim notifikasi WhatsApp:
      //    - Jika status berubah ke REVISI / REJECTED: kirim detail dokumen REVISI / REJECTED
      //    - Jika seluruh dokumen siswa kini APPROVED (TERVERIFIKASI) dan sebelumnya belum TERVERIFIKASI (atau dokumen berubah ke APPROVED): kirim pesan semua dokumen diterima
      let whatsappNotification: NotificationResultSummary | null = null;
      if (
        status === StatusDocument.REVISI ||
        status === StatusDocument.REJECTED
      ) {
        if (hasStatusChanged) {
          whatsappNotification = await this.sendValidationNotification(
            updatedDocument.id_student,
            [
              {
                document_id: updatedDocument.id,
                document_name: formatDocumentTypeName(
                  existingDocument.document_type.name,
                ),
                status: updatedDocument.status,
                keterangan: updatedDocument.keterangan,
              },
            ],
            false,
          );
        }
      } else if (status === StatusDocument.APPROVED) {
        const allApproved =
          newVerificationStatus === VerificationStatus.TERVERIFIKASI ||
          (await this.areAllStudentDocumentsApproved(
            updatedDocument.id_student,
          ));

        if (
          allApproved &&
          (hasStatusChanged ||
            previousVerificationStatus !== VerificationStatus.TERVERIFIKASI)
        ) {
          whatsappNotification = await this.sendValidationNotification(
            updatedDocument.id_student,
            [],
            true,
          );
        }
      }

      // Pisahkan id_student agar tidak ter-expose di response utama
      const { id_student, ...responseData } = updatedDocument;

      return {
        success: true,
        message: 'Validasi dokumen berhasil diperbarui',
        data: {
          ...responseData,
          verification_status: newVerificationStatus,
          whatsapp_notification: whatsappNotification,
        },
      };
    } catch (error) {
      this.handleException(error, 'Gagal memvalidasi dokumen');
    }
  }

  /**
   * Method untuk admin melakukan validasi bulk pada banyak dokumen milik satu siswa
   */
  async bulkValidateDocuments(
    studentId: number,
    bulkValidateDto: BulkValidateDocumentsDto,
  ) {
    try {
      const { documents } = bulkValidateDto;

      const studentRecord = await this.prisma.students.findUnique({
        where: { id: studentId },
        select: { id: true, verification_status: true },
      });

      const previousVerificationStatus = studentRecord?.verification_status;

      // 1. Ambil semua dokumen siswa ini dari database untuk validasi ownership & cek perubahan status
      const studentDocuments = await this.prisma.documents.findMany({
        where: { id_student: studentId },
        include: {
          document_type: true,
        },
      });

      if (!studentDocuments || studentDocuments.length === 0) {
        throw new NotFoundException(
          'Siswa tidak ditemukan atau belum memiliki dokumen',
        );
      }

      // 2. Validasi Ownership & Keberadaan Dokumen (IDOR prevention)
      const existingDocMap = new Map(
        studentDocuments.map((doc) => [doc.id, doc]),
      );

      for (const doc of documents) {
        if (!existingDocMap.has(doc.document_id)) {
          throw new BadRequestException(
            `Dokumen dengan ID ${doc.document_id} tidak valid atau bukan milik siswa ini (Potensi IDOR)`,
          );
        }
      }

      // 3. Identifikasi dokumen yang benar-benar mengalami perubahan status
      //    dan bangun query Prisma Update secara atomic
      const changedItems: ValidatedDocumentSummaryItem[] = [];
      const submittedDocIds = new Set(documents.map((d) => d.document_id));

      const transactionOperations = documents.map((doc) => {
        let finalKeterangan: string | null | undefined = doc.keterangan;

        if (doc.status === StatusDocument.APPROVED) {
          finalKeterangan = null;
        }

        const existingDoc = existingDocMap.get(doc.document_id);
        if (
          existingDoc &&
          existingDoc.status !== doc.status &&
          this.isNotifiableStatus(doc.status)
        ) {
          changedItems.push({
            document_id: doc.document_id,
            document_name: formatDocumentTypeName(
              existingDoc.document_type.name,
            ),
            status: doc.status,
            keterangan: finalKeterangan,
          });
        }

        return this.prisma.documents.update({
          where: { id: doc.document_id },
          data: {
            status: doc.status,
            keterangan: finalKeterangan,
          },
        });
      });

      // Jika semua dokumen yang dikirim pada bulk validation berstatus APPROVED,
      // pastikan dokumen lain milik siswa yang tidak ikut dikirim dari form frontend (misal dokumen opsional yang masih PENDING)
      // juga ikut di-set APPROVED agar tidak menggantung status verifikasi siswa.
      const allSubmittedAreApproved =
        documents.length > 0 &&
        documents.every((d) => d.status === StatusDocument.APPROVED);

      if (allSubmittedAreApproved) {
        for (const existingDoc of studentDocuments) {
          if (
            !submittedDocIds.has(existingDoc.id) &&
            (existingDoc.status === StatusDocument.PENDING ||
              existingDoc.status === StatusDocument.REVISI)
          ) {
            changedItems.push({
              document_id: existingDoc.id,
              document_name: formatDocumentTypeName(
                existingDoc.document_type.name,
              ),
              status: StatusDocument.APPROVED,
              keterangan: null,
            });
            transactionOperations.push(
              this.prisma.documents.update({
                where: { id: existingDoc.id },
                data: {
                  status: StatusDocument.APPROVED,
                  keterangan: null,
                },
              }),
            );
          }
        }
      }

      // 4. Eksekusi transaction, semua akan commit bersamaan
      await this.prisma.$transaction(transactionOperations);

      // 5. Update status verifikasi siswa secara otomatis
      const newVerificationStatus =
        await this.updateStudentVerificationStatus(studentId);

      // 6. Kirim satu pesan WhatsApp kolektif:
      //    - Jika ada dokumen yang berubah ke REVISI / REJECTED: kirim daftar REVISI & REJECTED saja
      //    - Jika semua dokumen siswa telah APPROVED (TERVERIFIKASI) dan ada perubahan ke APPROVED (atau status siswa baru berubah menjadi TERVERIFIKASI): kirim pesan semua dokumen diterima
      let whatsappNotification: NotificationResultSummary | null = null;
      const issueItems = changedItems.filter(
        (item) =>
          item.status === StatusDocument.REVISI ||
          item.status === StatusDocument.REJECTED,
      );

      if (issueItems.length > 0) {
        whatsappNotification = await this.sendValidationNotification(
          studentId,
          issueItems,
          false,
        );
      } else {
        const allApproved =
          newVerificationStatus === VerificationStatus.TERVERIFIKASI ||
          (await this.areAllStudentDocumentsApproved(studentId));

        if (
          allApproved &&
          (changedItems.length > 0 ||
            (previousVerificationStatus !== undefined &&
              previousVerificationStatus !== VerificationStatus.TERVERIFIKASI))
        ) {
          whatsappNotification = await this.sendValidationNotification(
            studentId,
            [],
            true,
          );
        }
      }

      return {
        success: true,
        message: 'Validasi dokumen berhasil',
        data: {
          student_id: studentId,
          total_documents: documents.length,
          changed_documents: changedItems.length,
          verification_status: newVerificationStatus,
          whatsapp_notification: whatsappNotification,
        },
      };
    } catch (error) {
      this.handleException(error, 'Gagal melakukan bulk validation dokumen');
    }
  }

  /**
   * Mengirim ulang notifikasi WhatsApp yang gagal (FAILED / PENDING)
   * tanpa mengubah status dokumen.
   */
  async retryNotification(notificationId: string) {
    try {
      const notification =
        await this.prisma.whatsapp_notifications.findUnique({
          where: { id: notificationId },
        });

      if (!notification) {
        throw new NotFoundException(
          'Data notifikasi WhatsApp tidak ditemukan',
        );
      }

      if (notification.status === NotificationStatus.SENT) {
        throw new BadRequestException(
          'Notifikasi WhatsApp ini sudah berhasil dikirim dan tidak dapat dikirim ulang',
        );
      }

      if (notification.attempts >= MAX_NOTIFICATION_ATTEMPTS) {
        throw new BadRequestException(
          `Batas maksimal percobaan pengiriman ulang (${MAX_NOTIFICATION_ATTEMPTS} kali) telah habis`,
        );
      }

      const attemptTime = new Date();
      let normalizedPhone = notification.phone_number;

      try {
        normalizedPhone = normalizePhoneNumber(notification.phone_number);
      } catch (err) {
        const reason =
          err instanceof Error
            ? err.message
            : 'Format nomor WhatsApp tidak valid';
        const failedUpdate = await this.prisma.whatsapp_notifications.update({
          where: { id: notification.id },
          data: {
            status: NotificationStatus.FAILED,
            attempts: { increment: 1 },
            fonnte_response: reason,
            last_attempt_at: attemptTime,
          },
        });

        throw new BadRequestException({
          success: false,
          message: `Gagal mengirim ulang notifikasi: ${reason}`,
          data: failedUpdate,
        });
      }

      try {
        const fonnteRes = await this.fonnteService.sendWhatsAppMessage(
          normalizedPhone,
          notification.message,
        );

        const updatedNotification =
          await this.prisma.whatsapp_notifications.update({
            where: { id: notification.id },
            data: {
              phone_number: normalizedPhone,
              status: NotificationStatus.SENT,
              attempts: { increment: 1 },
              fonnte_response:
                fonnteRes.detail || 'Pesan WhatsApp berhasil dikirim ulang',
              sent_at: attemptTime,
              last_attempt_at: attemptTime,
            },
          });

        return {
          success: true,
          message: 'Notifikasi WhatsApp berhasil dikirim ulang',
          data: {
            id: updatedNotification.id,
            id_student: updatedNotification.id_student,
            phone_number: updatedNotification.phone_number,
            status: updatedNotification.status,
            attempts: updatedNotification.attempts,
            fonnte_response: updatedNotification.fonnte_response,
            sent_at: updatedNotification.sent_at,
            last_attempt_at: updatedNotification.last_attempt_at,
          },
        };
      } catch (sendError) {
        const errorReason =
          sendError instanceof Error
            ? sendError.message
            : 'Gagal mengirim pesan melalui Fonnte';

        const failedNotification =
          await this.prisma.whatsapp_notifications.update({
            where: { id: notification.id },
            data: {
              status: NotificationStatus.FAILED,
              attempts: { increment: 1 },
              fonnte_response: errorReason,
              last_attempt_at: attemptTime,
            },
          });

        return {
          success: false,
          message: `Pengiriman ulang notifikasi gagal: ${errorReason}`,
          data: {
            id: failedNotification.id,
            id_student: failedNotification.id_student,
            phone_number: failedNotification.phone_number,
            status: failedNotification.status,
            attempts: failedNotification.attempts,
            fonnte_response: failedNotification.fonnte_response,
            sent_at: failedNotification.sent_at,
            last_attempt_at: failedNotification.last_attempt_at,
          },
        };
      }
    } catch (error) {
      this.handleException(
        error,
        'Gagal mengirim ulang notifikasi WhatsApp',
      );
    }
  }

  /**
   * Mengambil daftar riwayat notifikasi WhatsApp untuk Admin
   */
  async getNotifications(query?: QueryNotificationsDto) {
    try {
      const whereClause: {
        status?: NotificationStatus;
        id_student?: number;
      } = {};

      if (query?.status) {
        whereClause.status = query.status;
      }
      if (query?.studentId !== undefined) {
        whereClause.id_student = query.studentId;
      }

      const notifications =
        await this.prisma.whatsapp_notifications.findMany({
          where: whereClause,
          orderBy: { created_at: 'desc' },
          include: {
            student: {
              select: {
                id: true,
                no_daftar: true,
                nama: true,
                jurusan: true,
                verification_status: true,
              },
            },
          },
        });

      return {
        success: true,
        message: 'Berhasil mengambil riwayat notifikasi WhatsApp',
        data: notifications.map((item) => ({
          id: item.id,
          id_student: item.id_student,
          student: item.student,
          phone_number: item.phone_number,
          message: item.message,
          validation_summary: item.validation_summary,
          status: item.status,
          attempts: item.attempts,
          max_attempts: MAX_NOTIFICATION_ATTEMPTS,
          can_retry:
            item.status !== NotificationStatus.SENT &&
            item.attempts < MAX_NOTIFICATION_ATTEMPTS,
          fonnte_response: item.fonnte_response,
          sent_at: item.sent_at,
          last_attempt_at: item.last_attempt_at,
          created_at: item.created_at,
        })),
      };
    } catch (error) {
      this.handleException(
        error,
        'Gagal mengambil riwayat notifikasi WhatsApp',
      );
    }
  }

  /**
   * Mengambil riwayat notifikasi WhatsApp untuk satu siswa tertentu
   */
  async getStudentNotifications(studentId: number) {
    return this.getNotifications({ studentId });
  }

  /**
   * Helper method untuk update status verifikasi siswa secara otomatis.
   */
  async updateStudentVerificationStatus(
    studentId: number,
  ): Promise<VerificationStatus> {
    const studentDocuments = await this.prisma.documents.findMany({
      where: { id_student: studentId },
    });

    let newStatus: VerificationStatus = VerificationStatus.BELUM_SUBMIT;

    if (studentDocuments.length > 0) {
      const hasRejected = studentDocuments.some(
        (doc) => doc.status === StatusDocument.REJECTED,
      );
      const hasRevisi = studentDocuments.some(
        (doc) => doc.status === StatusDocument.REVISI,
      );
      const allApproved = studentDocuments.every(
        (doc) => doc.status === StatusDocument.APPROVED,
      );

      if (hasRejected) {
        newStatus = VerificationStatus.DITOLAK;
      } else if (hasRevisi) {
        newStatus = VerificationStatus.REVISI;
      } else if (allApproved) {
        newStatus = VerificationStatus.TERVERIFIKASI;
      } else {
        newStatus = VerificationStatus.MENUNGGU_VALIDASI;
      }
    }

    await this.prisma.students.update({
      where: { id: studentId },
      data: { verification_status: newStatus },
    });

    return newStatus;
  }

  /**
   * Reusable helper untuk menangani exception agar pesan error lebih rapi
   */
  private handleException(error: unknown, defaultMessage: string): never {
    if (
      error instanceof NotFoundException ||
      error instanceof BadRequestException ||
      error instanceof ForbiddenException
    ) {
      throw error;
    }

    console.error(defaultMessage, error);

    throw new InternalServerErrorException({
      success: false,
      message: defaultMessage,
      error: 'Terjadi kesalahan pada server',
    });
  }
}
