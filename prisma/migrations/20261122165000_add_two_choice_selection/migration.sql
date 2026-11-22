-- AlterTable students: tambah jurusan_pilihan_1 & jurusan_pilihan_2
ALTER TABLE `students`
    ADD COLUMN `jurusan_pilihan_1` ENUM('TKJ', 'TKR', 'ATP', 'AK', 'DKV') NULL,
    ADD COLUMN `jurusan_pilihan_2` ENUM('TKJ', 'TKR', 'ATP', 'AK', 'DKV') NULL;

-- Backfill jurusan_pilihan_1 untuk data siswa yang sudah ada
UPDATE `students` SET `jurusan_pilihan_1` = `jurusan` WHERE `jurusan_pilihan_1` IS NULL;

-- AlterTable student_ranking: tambah detail hasil seleksi dua tahap
ALTER TABLE `student_ranking`
    ADD COLUMN `nilai_rapor` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `nilai_rata_rata_rapor` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `nilai_ujian` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `jurusan_pilihan_1` ENUM('TKJ', 'TKR', 'ATP', 'AK', 'DKV') NULL,
    ADD COLUMN `jurusan_pilihan_2` ENUM('TKJ', 'TKR', 'ATP', 'AK', 'DKV') NULL,
    ADD COLUMN `jurusan_diterima` ENUM('TKJ', 'TKR', 'ATP', 'AK', 'DKV') NULL,
    ADD COLUMN `jalur_penerimaan` ENUM('PILIHAN_1', 'PILIHAN_2') NULL,
    ADD COLUMN `status_akhir` ENUM('DITERIMA', 'TIDAK_DITERIMA') NOT NULL DEFAULT 'TIDAK_DITERIMA';

-- AlterTable student_announcements: tambah jurusan_diterima & jalur_penerimaan
ALTER TABLE `student_announcements`
    ADD COLUMN `jurusan_diterima` ENUM('TKJ', 'TKR', 'ATP', 'AK', 'DKV') NULL,
    ADD COLUMN `jalur_penerimaan` ENUM('PILIHAN_1', 'PILIHAN_2') NULL;
