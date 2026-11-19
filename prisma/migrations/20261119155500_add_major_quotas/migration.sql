-- CreateTable
CREATE TABLE `major_quotas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `jurusan` ENUM('TKJ', 'TKR', 'ATP', 'AK', 'DKV') NOT NULL,
    `quota` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MajorQuota_jurusan_key`(`jurusan`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
