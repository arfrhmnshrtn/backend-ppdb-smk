-- CreateTable
CREATE TABLE `nilai_scores` (
    `id` VARCHAR(191) NOT NULL,
    `student_id` INTEGER NOT NULL,
    `math_score` INTEGER NOT NULL,
    `indonesia_score` INTEGER NOT NULL,
    `english_score` INTEGER NOT NULL,
    `religion_score` INTEGER NOT NULL,
    `average_score` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `nilai_scores_student_id_key`(`student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `nilai_scores` ADD CONSTRAINT `nilai_scores_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
