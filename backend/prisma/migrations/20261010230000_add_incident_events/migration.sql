-- CreateTable
CREATE TABLE `IncidentEvent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `incidentId` INTEGER NOT NULL,
    `type` ENUM('INCIDENT_CREATED', 'STATUS_CHANGED', 'INCIDENT_RESOLVED', 'CORRECTIVE_ACTION_ADDED', 'CORRECTIVE_ACTION_REMOVED', 'ATTACHMENT_ADDED') NOT NULL,
    `actorId` INTEGER NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `IncidentEvent_incidentId_createdAt_idx`(`incidentId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `IncidentEvent` ADD CONSTRAINT `IncidentEvent_incidentId_fkey` FOREIGN KEY (`incidentId`) REFERENCES `Incident`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IncidentEvent` ADD CONSTRAINT `IncidentEvent_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
