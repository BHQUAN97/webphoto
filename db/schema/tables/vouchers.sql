-- ============================================================
-- TABLE: vouchers
-- Source: photo-storage/server/src/database/schema.ts
-- ============================================================
CREATE TABLE IF NOT EXISTS `vouchers` (
  `id`            VARCHAR(26) NOT NULL PRIMARY KEY,
  `code`          VARCHAR(50) NOT NULL,
  `type`          ENUM('plan_activation','addon_storage','addon_days') NOT NULL DEFAULT 'plan_activation',
  `plan_id`       VARCHAR(26) DEFAULT NULL,
  `duration_days` INT         NOT NULL DEFAULT 30,
  `addon_bytes`   BIGINT      DEFAULT NULL,
  `max_uses`      INT         DEFAULT NULL,
  `used_count`    INT         NOT NULL DEFAULT 0,
  `valid_from`    DATETIME    NOT NULL DEFAULT NOW(),
  `valid_until`   DATETIME    DEFAULT NULL,
  `is_active`     BOOLEAN     NOT NULL DEFAULT TRUE,
  `created_by`    VARCHAR(26) DEFAULT NULL,
  `created_at`    DATETIME    NOT NULL DEFAULT NOW(),
  UNIQUE INDEX `vouchers_code_idx` (`code`),
  INDEX `vouchers_active_idx` (`is_active`, `valid_from`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
