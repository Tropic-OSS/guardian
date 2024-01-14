/*
  Warnings:

  - Added the required column `updated_at` to the `Application` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `Interview` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `Member` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `Server` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Application` ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL,
    MODIFY `status` ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'DELETED') NOT NULL;

-- AlterTable
ALTER TABLE `Interview` ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL,
    MODIFY `status` ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'DELETED') NOT NULL;

-- AlterTable
ALTER TABLE `Member` ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `Server` ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `Session` ADD COLUMN `is_deleted` BOOLEAN NOT NULL DEFAULT false;
