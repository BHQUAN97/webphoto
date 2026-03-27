-- ============================================================
-- TABLE: payment_methods
-- Source: photo-storage/server/src/database/schema.ts
-- ============================================================
CREATE TABLE IF NOT EXISTS `payment_methods` (
  `id`         VARCHAR(26)  NOT NULL PRIMARY KEY,
  `type`       ENUM('bank_transfer','momo','zalopay','cash') NOT NULL,
  `name`       VARCHAR(100) NOT NULL,
  `is_active`  BOOLEAN      NOT NULL DEFAULT TRUE,
  `is_default` BOOLEAN      NOT NULL DEFAULT FALSE,
  `sort_order` INT          NOT NULL DEFAULT 0,
  `config`     TEXT         NOT NULL,
  `created_at` DATETIME     NOT NULL DEFAULT NOW(),
  `updated_at` DATETIME     NOT NULL DEFAULT NOW(),
  INDEX `pm_active_idx` (`is_active`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
