import { StatusDocument } from '../../../generated/prisma/client';

export interface ValidatedDocumentSummaryItem {
  document_id: string;
  document_name: string;
  status: StatusDocument;
  keterangan?: string | null;
}

export interface ValidationSummaryPayload {
  all_approved: boolean;
  revisi: ValidatedDocumentSummaryItem[];
  rejected: ValidatedDocumentSummaryItem[];
}

const DOCUMENT_NAME_MAP: Record<string, string> = {
  surat_keterangan_lulus: 'Surat Keterangan Lulus',
  raport: 'Rapor',
  ktp_ayah: 'KTP Ayah',
  ktp_ibu: 'KTP Ibu',
  kartu_keluarga: 'Kartu Keluarga',
  akta_kelahiran: 'Akta Kelahiran',
  pas_foto: 'Pas Foto',
  sptjm: 'SPTJM',
  kip: 'KIP',
  paiagam: 'Piagam',
  sk_osis: 'SK OSIS',
  sk_pramuka: 'SK Pramuka',
};

export function formatDocumentTypeName(rawName: string): string {
  const key = rawName.trim().toLowerCase();
  if (DOCUMENT_NAME_MAP[key]) {
    return DOCUMENT_NAME_MAP[key];
  }
  if (rawName.includes('_')) {
    return rawName
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
  return rawName;
}

export function groupValidatedDocuments(
  items: ValidatedDocumentSummaryItem[],
  allApproved = false,
): ValidationSummaryPayload {
  return {
    all_approved: allApproved,
    revisi: items.filter((item) => item.status === StatusDocument.REVISI),
    rejected: items.filter((item) => item.status === StatusDocument.REJECTED),
  };
}

export function buildValidationWhatsAppMessage(
  studentName: string,
  registrationNumber: string,
  items: ValidatedDocumentSummaryItem[],
  allApproved = false,
): string {
  const grouped = groupValidatedDocuments(items, allApproved);

  const lines: string[] = [
    'Yth. Calon Peserta Didik PPDB SMKN 1 Simpang Pematang.',
    '',
    'Kami informasikan hasil pemeriksaan dokumen pendaftaran Anda.',
    '',
    `Nama: ${studentName}`,
    `Nomor Pendaftaran: ${registrationNumber}`,
    '',
    'HASIL VALIDASI DOKUMEN:',
  ];

  if (allApproved) {
    lines.push(
      '',
      'Selamat! Seluruh dokumen pendaftaran Anda telah berhasil divalidasi dan diterima (APPROVED).',
      '',
      'Silakan login ke sistem PPDB untuk melihat detail status pendaftaran dan informasi tahapan seleksi berikutnya.',
      '',
      'Terima kasih.',
      'Panitia PPDB SMKN 1 Simpang Pematang.',
    );
    return lines.join('\n');
  }

  if (grouped.revisi.length > 0) {
    lines.push('', 'Dokumen Perlu Diperbaiki:');
    grouped.revisi.forEach((doc, index) => {
      lines.push(`${index + 1}. ${doc.document_name} - REVISI`);
      lines.push(
        `   Keterangan: ${doc.keterangan || 'Silakan perbaiki dokumen sesuai ketentuan.'}`,
      );
    });
  }

  if (grouped.rejected.length > 0) {
    lines.push('', 'Dokumen Ditolak:');
    grouped.rejected.forEach((doc, index) => {
      lines.push(`${index + 1}. ${doc.document_name} - REJECTED`);
      lines.push(
        `   Keterangan: ${doc.keterangan || 'Dokumen tidak sesuai dengan persyaratan.'}`,
      );
    });
  }

  lines.push(
    '',
    'Silakan login ke sistem PPDB untuk melihat detail dokumen dan melakukan perbaikan jika diperlukan.',
    '',
    'Terima kasih.',
    'Panitia PPDB SMKN 1 Simpang Pematang.',
  );

  return lines.join('\n');
}
