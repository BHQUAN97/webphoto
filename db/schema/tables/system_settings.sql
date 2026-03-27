-- ============================================================
-- TABLE: system_settings
-- Source: photo-storage/server/src/database/schema.ts
-- ============================================================
CREATE TABLE IF NOT EXISTS `system_settings` (
  `key`        VARCHAR(100) NOT NULL PRIMARY KEY,
  `value`      TEXT         NOT NULL,
  `updated_at` DATETIME     NOT NULL DEFAULT NOW(),
  `updated_by` VARCHAR(26)  DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
