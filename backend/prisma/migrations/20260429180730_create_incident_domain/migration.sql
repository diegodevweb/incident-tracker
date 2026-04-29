/*
  Warnings:

  - You are about to drop the column `environment` on the `IncidentLog` table. All the data in the column will be lost.
  - You are about to drop the column `ocurredAt` on the `IncidentLog` table. All the data in the column will be lost.
  - You are about to drop the column `source` on the `IncidentLog` table. All the data in the column will be lost.
  - You are about to alter the column `level` on the `IncidentLog` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(4))`.
  - Added the required column `incidentId` to the `IncidentLog` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `IncidentLog` DROP COLUMN `environment`,
    DROP COLUMN `ocurredAt`,
    DROP COLUMN `source`,
    ADD COLUMN `incidentId` INTEGER NOT NULL,
    ADD COLUMN `occurredAt` DATETIME(3) NULL,
    MODIFY `level` ENUM('INFO', 'WARNING', 'ERROR', 'CRITICAL') NOT NULL DEFAULT 'INFO';

-- AlterTable
ALTER TABLE `User` ADD COLUMN `role` ENUM('ADMIN', 'CLIENT') NOT NULL DEFAULT 'CLIENT';

-- CreateTable
CREATE TABLE `Incident` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `status` ENUM('OPEN', 'PENDING', 'IN_PROGRESS', 'RESOLVED') NOT NULL DEFAULT 'OPEN',
    `priority` ENUM('INFO', 'WARNING', 'ERROR', 'CRITICAL') NOT NULL DEFAULT 'INFO',
    `source` ENUM('WEBHOOK', 'DASHBOARD') NOT NULL DEFAULT 'DASHBOARD',
    `environment` VARCHAR(191) NOT NULL,
    `clientId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IncidentAttachment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `incidentId` INTEGER NOT NULL,
    `filename` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Incident` ADD CONSTRAINT `Incident_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IncidentAttachment` ADD CONSTRAINT `IncidentAttachment_incidentId_fkey` FOREIGN KEY (`incidentId`) REFERENCES `Incident`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IncidentLog` ADD CONSTRAINT `IncidentLog_incidentId_fkey` FOREIGN KEY (`incidentId`) REFERENCES `Incident`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
