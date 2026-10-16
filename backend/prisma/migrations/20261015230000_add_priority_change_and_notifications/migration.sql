-- AlterTable
ALTER TABLE `IncidentEvent` MODIFY `type` ENUM('INCIDENT_CREATED', 'STATUS_CHANGED', 'INCIDENT_RESOLVED', 'CORRECTIVE_ACTION_ADDED', 'CORRECTIVE_ACTION_REMOVED', 'ATTACHMENT_ADDED', 'PRIORITY_CHANGED') NOT NULL;

-- CreateTable
CREATE TABLE `Notification` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `incidentId` INTEGER NOT NULL,
    `type` ENUM('STATUS_CHANGED', 'PRIORITY_CHANGED', 'COMMENT_ADDED', 'CORRECTIVE_ACTION_UPDATED') NOT NULL,
    `metadata` JSON NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `Notification_userId_readAt_idx`(`userId`, `readAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_incidentId_fkey` FOREIGN KEY (`incidentId`) REFERENCES `Incident`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

