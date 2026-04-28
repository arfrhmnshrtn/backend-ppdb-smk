-- CreateTable
CREATE TABLE `Berkas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `idUser` INTEGER NOT NULL,
    `no_daftar` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `no_hp` VARCHAR(191) NOT NULL,
    `nisn` VARCHAR(191) NOT NULL,
    `asal_sekolah` VARCHAR(191) NOT NULL,
    `alamat` VARCHAR(191) NOT NULL,
    `jurusan` ENUM('TKJ', 'TKR', 'ATP', 'AK', 'DKV') NOT NULL,
    `surat_keterangan_lulus` VARCHAR(191) NOT NULL,
    `raport` VARCHAR(191) NOT NULL,
    `ktp_ayah` VARCHAR(191) NOT NULL,
    `ktp_ibu` VARCHAR(191) NOT NULL,
    `kartu_keluarga` VARCHAR(191) NOT NULL,
    `akta_kelahiran` VARCHAR(191) NOT NULL,
    `pas_foto` VARCHAR(191) NOT NULL,
    `sptjm` VARCHAR(191) NOT NULL,
    `kip` VARCHAR(191) NOT NULL,
    `paiagam` VARCHAR(191) NOT NULL,
    `sk_osis` VARCHAR(191) NOT NULL,
    `sk_pramuka` VARCHAR(191) NOT NULL,
    `status_berkas` ENUM('PENDING', 'APPROVED', 'REVISI', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
