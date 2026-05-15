import { IsEnum, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';
import { StatusDocument } from '../../../generated/prisma/client';

export class ValidateDocumentDto {
  @IsEnum(StatusDocument, { message: 'Status tidak valid' })
  @IsNotEmpty({ message: 'Status dokumen wajib diisi' })
  status!: StatusDocument;

  @ValidateIf((o) => o.status === StatusDocument.REVISI || o.status === StatusDocument.REJECTED)
  @IsString({ message: 'Keterangan harus berupa teks' })
  @IsNotEmpty({ message: 'Keterangan wajib diisi jika status REVISI atau REJECTED' })
  keterangan?: string;
}
