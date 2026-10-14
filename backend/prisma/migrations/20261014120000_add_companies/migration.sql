-- F3: empresas clientes. Cada usuário CLIENT de hoje vira uma empresa com o
-- mesmo id, então chamados e chaves de webhook passam a apontar para a empresa
-- sem precisar de tabela de correspondência.

-- CreateTable
CREATE TABLE `Company` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `cnpj` CHAR(14) NULL,
    `disabledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Company_cnpj_key`(`cnpj`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Uma empresa por usuário CLIENT, com o nome e a situação dele. Também para
-- qualquer outro usuário dono de chamado: antes do F3, o admin que abria um
-- chamado sem informar o cliente ficava como dono dele.
INSERT INTO `Company` (`id`, `name`, `disabledAt`, `createdAt`, `updatedAt`)
SELECT `u`.`id`,
       `u`.`name`,
       IF(`u`.`role` = 'CLIENT', `u`.`disabledAt`, NULL),
       `u`.`createdAt`,
       CURRENT_TIMESTAMP(3)
FROM `User` `u`
WHERE `u`.`role` = 'CLIENT'
   OR EXISTS (SELECT 1 FROM `Incident` `i` WHERE `i`.`clientId` = `u`.`id`);

-- Usuários CLIENT ficam na empresa criada a partir deles.
ALTER TABLE `User` ADD COLUMN `companyId` INTEGER NULL;
UPDATE `User` SET `companyId` = `id` WHERE `role` = 'CLIENT';
CREATE INDEX `User_companyId_idx` ON `User`(`companyId`);

-- Chamados: a empresa é o antigo cliente; quem abriu sai do evento de criação
-- (F4). Chamados de antes do F4 ficam sem autor conhecido.
ALTER TABLE `Incident` DROP FOREIGN KEY `Incident_clientId_fkey`;
ALTER TABLE `Incident` ADD COLUMN `companyId` INTEGER NULL,
    ADD COLUMN `createdById` INTEGER NULL;
UPDATE `Incident` SET `companyId` = `clientId`;
UPDATE `Incident` `i`
JOIN `IncidentEvent` `e`
  ON `e`.`incidentId` = `i`.`id` AND `e`.`type` = 'INCIDENT_CREATED'
SET `i`.`createdById` = `e`.`actorId`;
ALTER TABLE `Incident` DROP COLUMN `clientId`,
    MODIFY `companyId` INTEGER NOT NULL;

-- Chaves de webhook passam para a empresa.
ALTER TABLE `WebhookKey` DROP FOREIGN KEY `WebhookKey_clientId_fkey`;
ALTER TABLE `WebhookKey` ADD COLUMN `companyId` INTEGER NULL;
UPDATE `WebhookKey` SET `companyId` = `clientId`;
ALTER TABLE `WebhookKey` DROP COLUMN `clientId`,
    MODIFY `companyId` INTEGER NOT NULL;
CREATE INDEX `WebhookKey_companyId_idx` ON `WebhookKey`(`companyId`);

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Incident` ADD CONSTRAINT `Incident_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Incident` ADD CONSTRAINT `Incident_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WebhookKey` ADD CONSTRAINT `WebhookKey_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
