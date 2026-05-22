-- CreateTable
CREATE TABLE `student_ranking` (
    `id` VARCHAR(191) NOT NULL,
    `id_student` INTEGER NOT NULL,
    `final_score` DOUBLE NOT NULL,
    `ranking` INTEGER NOT NULL,
    `jurusan` ENUM('TKJ', 'TKR', 'ATP', 'AK', 'DKV') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `student_ranking_id_student_key`(`id_student`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_announcements` (
    `id` VARCHAR(191) NOT NULL,
    `id_student` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'PASSED', 'FAILED', 'RESERVE') NOT NULL DEFAULT 'PENDING',
    `published_at` DATETIME(3) NULL,
    `is_published` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `student_announcements_id_student_key`(`id_student`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `student_ranking` ADD CONSTRAINT `student_ranking_id_student_fkey` FOREIGN KEY (`id_student`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_announcements` ADD CONSTRAINT `student_announcements_id_student_fkey` FOREIGN KEY (`id_student`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
