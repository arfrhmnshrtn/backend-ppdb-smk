-- AlterTable
ALTER TABLE `students` ADD COLUMN `foto` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `test_schedules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tanggal_test` DATETIME(3) NOT NULL,
    `jam_test` VARCHAR(191) NOT NULL,
    `lokasi_test` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
