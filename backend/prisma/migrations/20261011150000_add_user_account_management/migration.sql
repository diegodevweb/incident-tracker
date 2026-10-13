-- AlterTable
ALTER TABLE `User` ADD COLUMN `disabledAt` DATETIME(3) NULL,
    ADD COLUMN `mustChangePassword` BOOLEAN NOT NULL DEFAULT false;

