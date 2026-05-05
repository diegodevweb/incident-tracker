-- AlterTable
ALTER TABLE `Incident`
    ADD COLUMN `correctiveActions` TEXT NULL;

-- AlterTable
ALTER TABLE `IncidentAttachment`
    ADD COLUMN `category` ENUM('GENERAL', 'CORRECTIVE_ACTION') NOT NULL DEFAULT 'GENERAL';

-- CreateTable
CREATE TABLE `PreventiveAction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `description` TEXT NOT NULL,
    `incidentId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PreventiveAction`
    ADD CONSTRAINT `PreventiveAction_incidentId_fkey`
    FOREIGN KEY (`incidentId`) REFERENCES `Incident`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
