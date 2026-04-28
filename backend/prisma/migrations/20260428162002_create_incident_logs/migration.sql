-- CreateTable
CREATE TABLE `IncidentLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `message` VARCHAR(191) NOT NULL,
    `level` VARCHAR(191) NOT NULL,
    `environment` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `ocurredAt` DATETIME(3) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
