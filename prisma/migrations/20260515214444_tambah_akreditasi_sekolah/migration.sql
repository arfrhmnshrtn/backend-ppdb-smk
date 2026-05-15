/*
  Warnings:

  - Made the column `akreditasi_sekolah` on table `students` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `students` MODIFY `akreditasi_sekolah` VARCHAR(191) NOT NULL;
