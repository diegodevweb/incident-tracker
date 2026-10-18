-- AlterTable
ALTER TABLE `Incident` ADD COLUMN `firstRespondedAt` DATETIME(3) NULL,
    ADD COLUMN `responsePriority` ENUM('INFO', 'WARNING', 'ERROR', 'CRITICAL') NULL;

-- Chamados que já existem: a primeira resposta sai da autoria e do histórico.
-- `responsePriority` fica nulo neles, e o prazo sai da criticidade atual.

-- Aberto por um admin: respondido na abertura.
UPDATE `Incident` AS i
    INNER JOIN `User` AS u ON u.`id` = i.`createdById`
SET i.`firstRespondedAt` = i.`createdAt`
WHERE u.`role` = 'ADMIN';

-- Os demais: a primeira mensagem ou mudança de status de um admin.
UPDATE `Incident` AS i
    INNER JOIN (
        SELECT r.`incidentId`, MIN(r.`at`) AS `at`
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
        GROUP BY r.`incidentId`
    ) AS f ON f.`incidentId` = i.`id`
SET i.`firstRespondedAt` = f.`at`
WHERE i.`firstRespondedAt` IS NULL;
