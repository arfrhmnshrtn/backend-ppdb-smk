import { Type } from 'class-transformer';
import {
  IsArray,
  ValidateNested,
  IsEnum,
  IsNotEmpty,
  IsString,
  ValidateIf,
} from 'class-validator';
import { StatusDocument } from '../../../generated/prisma/client';

export class ValidateDocumentItemDto {
  @IsString({ message: 'Document ID harus berupa string' })
  @IsNotEmpty({ message: 'Document ID wajib diisi' })
  document_id!: string;

  @IsEnum(StatusDocument, { message: 'Status tidak valid' })
  @IsNotEmpty({ message: 'Status dokumen wajib diisi' })
  status!: StatusDocument;

  @ValidateIf(
    (o) =>
      o.status === StatusDocument.REVISI ||
      o.status === StatusDocument.REJECTED,
  )
  @IsString({ message: 'Keterangan harus berupa teks' })
  @IsNotEmpty({
    message: 'Keterangan wajib diisi jika status REVISI atau REJECTED',
  })
  keterangan?: string | null;
}

export class BulkValidateDocumentsDto {
  @IsArray({ message: 'Documents harus berupa array' })
  @ValidateNested({ each: true })
  @Type(() => ValidateDocumentItemDto)
  documents!: ValidateDocumentItemDto[];
}
