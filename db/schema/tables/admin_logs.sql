-- ============================================================
-- TABLE: admin_logs
-- Source: photo-storage/server/src/database/schema.ts
-- ============================================================
CREATE TABLE IF NOT EXISTS `admin_logs` (
  `id`          VARCHAR(26)  NOT NULL PRIMARY KEY,
  `admin_id`    VARCHAR(26)  NOT NULL,
  `action`      VARCHAR(100) NOT NULL,
  `target_type` VARCHAR(50)  DEFAULT NULL,
  `target_id`   VARCHAR(26)  DEFAULT NULL,
  `meta`        TEXT         DEFAULT NULL,
  `created_at`  DATETIME     NOT NULL DEFAULT NOW(),
  INDEX `admin_logs_admin_idx` (`admin_id`, `created_at`),
  INDEX `admin_logs_target_idx` (`target_type`, `target_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
