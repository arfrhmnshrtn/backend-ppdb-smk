-- CreateTable
CREATE TABLE `whatsapp_notifications` (
    `id` VARCHAR(191) NOT NULL,
    `id_student` INTEGER NOT NULL,
    `phone_number` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `validation_summary` JSON NULL,
    `status` ENUM('PENDING', 'SENT', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `fonnte_response` TEXT NULL,
    `sent_at` DATETIME(3) NULL,
    `last_attempt_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `whatsapp_notifications_id_student_fkey`(`id_student`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `whatsapp_notifications` ADD CONSTRAINT `whatsapp_notifications_id_student_fkey` FOREIGN KEY (`id_student`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
