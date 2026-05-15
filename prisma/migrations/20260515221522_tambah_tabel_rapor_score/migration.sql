-- CreateTable
CREATE TABLE `RaporScore` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `id_student` INTEGER NOT NULL,
    `semester_1` DOUBLE NOT NULL,
    `semester_2` DOUBLE NOT NULL,
    `semester_3` DOUBLE NOT NULL,
    `semester_4` DOUBLE NOT NULL,
    `semester_5` DOUBLE NOT NULL,
    `semester_6` DOUBLE NOT NULL,
    `prestasi` INTEGER NOT NULL DEFAULT 0,
    `rata_rata` DOUBLE NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `rapor_scores_id_student_fkey`(`id_student`),
    UNIQUE INDEX `rapor_scores_id_student_unique`(`id_student`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RaporScore` ADD CONSTRAINT `RaporScore_id_student_fkey` FOREIGN KEY (`id_student`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
