/*
  Warnings:

  - You are about to drop the `berkas` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `berkas` DROP FOREIGN KEY `Berkas_idUser_fkey`;

-- DropTable
DROP TABLE `berkas`;

-- CreateTable
CREATE TABLE `students` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `id_user` INTEGER NOT NULL,
    `no_daftar` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `no_hp` VARCHAR(191) NOT NULL,
    `nisn` VARCHAR(191) NOT NULL,
    `asal_sekolah` VARCHAR(191) NOT NULL,
    `alamat` VARCHAR(191) NOT NULL,
    `jurusan` ENUM('TKJ', 'TKR', 'ATP', 'AK', 'DKV') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `documentsId` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_types` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `documents` (
    `id` VARCHAR(191) NOT NULL,
    `id_student` INTEGER NOT NULL,
    `id_document_type` INTEGER NOT NULL,
    `file_path` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REVISI', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `keterangan` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_document_typesTodocuments` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_document_typesTodocuments_AB_unique`(`A`, `B`),
    INDEX `_document_typesTodocuments_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_id_user_fkey` FOREIGN KEY (`id_user`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_documentsId_fkey` FOREIGN KEY (`documentsId`) REFERENCES `documents`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_document_typesTodocuments` ADD CONSTRAINT `_document_typesTodocuments_A_fkey` FOREIGN KEY (`A`) REFERENCES `document_types`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_document_typesTodocuments` ADD CONSTRAINT `_document_typesTodocuments_B_fkey` FOREIGN KEY (`B`) REFERENCES `documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
