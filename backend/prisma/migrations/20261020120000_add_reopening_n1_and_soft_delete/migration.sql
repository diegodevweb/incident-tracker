-- AlterTable
ALTER TABLE `Incident` ADD COLUMN `reopenedAt` DATETIME(3) NULL,
    ADD COLUMN `reopenRespondedAt` DATETIME(3) NULL,
    ADD COLUMN `reopenResponsePriority` ENUM('INFO', 'WARNING', 'ERROR', 'CRITICAL') NULL,
    ADD COLUMN `n1ClassifiedAt` DATETIME(3) NULL,
    ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `deletedById` INTEGER NULL,
    ADD COLUMN `deletionReason` TEXT NULL;

-- AlterTable
ALTER TABLE `IncidentEvent` MODIFY `type` ENUM('INCIDENT_CREATED', 'STATUS_CHANGED', 'INCIDENT_RESOLVED', 'CORRECTIVE_ACTION_ADDED', 'CORRECTIVE_ACTION_REMOVED', 'ATTACHMENT_ADDED', 'PRIORITY_CHANGED', 'N1_CLASSIFIED', 'N1_REMOVED', 'INCIDENT_DELETED', 'INCIDENT_RESTORED') NOT NULL;

-- AlterTable
ALTER TABLE `Notification` MODIFY `type` ENUM('STATUS_CHANGED', 'PRIORITY_CHANGED', 'COMMENT_ADDED', 'CORRECTIVE_ACTION_UPDATED', 'N1_CLASSIFIED', 'N1_REMOVED') NOT NULL;

-- AddForeignKey
ALTER TABLE `Incident` ADD CONSTRAINT `Incident_deletedById_fkey` FOREIGN KEY (`deletedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Chamados que já existem, refeitos a partir do histórico.

-- Resolvido pelo cliente antes de qualquer resposta: a primeira resposta fica
-- encerrada. O que a equipe fez depois conta na reabertura (abaixo).
UPDATE `Incident` AS i
SET i.`firstRespondedAt` = NULL,
    i.`responsePriority` = NULL
WHERE i.`firstRespondedAt` IS NOT NULL
    AND EXISTS (
        SELECT 1
        FROM `IncidentEvent` AS e
            INNER JOIN `User` AS u ON u.`id` = e.`actorId`
        WHERE e.`incidentId` = i.`id`
            AND e.`type` = 'INCIDENT_RESOLVED'
            AND u.`role` = 'CLIENT'
            AND e.`createdAt` < i.`firstRespondedAt`
    );

-- A última reabertura: a última saída de resolvido para outro status.
UPDATE `Incident` AS i
    INNER JOIN (
        SELECT e.`incidentId`, MAX(e.`createdAt`) AS `at`
        FROM `IncidentEvent` AS e
        WHERE e.`type` = 'STATUS_CHANGED'
            AND JSON_UNQUOTE(JSON_EXTRACT(e.`metadata`, '$.fromStatus')) = 'RESOLVED'
        GROUP BY e.`incidentId`
    ) AS r ON r.`incidentId` = i.`id`
SET i.`reopenedAt` = r.`at`;

-- A resposta a ela: a primeira mensagem ou mudança de status de um admin desde
-- a reabertura (a própria, quando foi um admin que reabriu). Como na primeira
-- resposta, `reopenResponsePriority` fica nulo e vale a criticidade atual.
UPDATE `Incident` AS i
SET i.`reopenRespondedAt` = (
    SELECT MIN(r.`at`)
    FROM (
        SELECT c.`incidentId`, c.`createdAt` AS `at`
        FROM `IncidentComment` AS c
            INNER JOIN `User` AS u ON u.`id` = c.`authorId`
        WHERE u.`role` = 'ADMIN'
        UNION ALL
        SELECT e.`incidentId`, e.`createdAt` AS `at`
        FROM `IncidentEvent` AS e
            INNER JOIN `User` AS u ON u.`id` = e.`actorId`
        WHERE u.`role` = 'ADMIN'
            AND e.`type` IN ('STATUS_CHANGED', 'INCIDENT_RESOLVED')
    ) AS r
    WHERE r.`incidentId` = i.`id`
        AND r.`at` >= i.`reopenedAt`
)
WHERE i.`reopenedAt` IS NOT NULL;
