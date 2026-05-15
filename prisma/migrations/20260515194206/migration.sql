/*
  Warnings:

  - The primary key for the `document_types` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `document_types` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Int`.
  - You are about to drop the column `documentsId` on the `students` table. All the data in the column will be lost.
  - You are about to drop the `_document_typestodocuments` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[name]` on the table `document_types` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id_user]` on the table `students` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `_document_typestodocuments` DROP FOREIGN KEY `_document_typesTodocuments_A_fkey`;

-- DropForeignKey
ALTER TABLE `_document_typestodocuments` DROP FOREIGN KEY `_document_typesTodocuments_B_fkey`;

-- DropForeignKey
ALTER TABLE `students` DROP FOREIGN KEY `students_documentsId_fkey`;

-- DropIndex
DROP INDEX `students_documentsId_fkey` ON `students`;

-- AlterTable
ALTER TABLE `document_types` DROP PRIMARY KEY,
    MODIFY `id` INTEGER NOT NULL AUTO_INCREMENT,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `students` DROP COLUMN `documentsId`,
    ADD COLUMN `verification_status` ENUM('BELUM_SUBMIT', 'MENUNGGU_VALIDASI', 'REVISI', 'TERVERIFIKASI', 'DITOLAK') NOT NULL DEFAULT 'BELUM_SUBMIT';

-- DropTable
DROP TABLE `_document_typestodocuments`;

-- CreateIndex
CREATE UNIQUE INDEX `document_types_name_key` ON `document_types`(`name`);

-- CreateIndex
CREATE UNIQUE INDEX `students_id_user_key` ON `students`(`id_user`);

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_id_student_fkey` FOREIGN KEY (`id_student`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_id_document_type_fkey` FOREIGN KEY (`id_document_type`) REFERENCES `document_types`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
