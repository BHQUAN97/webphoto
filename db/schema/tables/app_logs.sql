-- ============================================================
-- TABLE: app_logs
-- Source: photo-storage/server/src/database/schema.ts
-- ============================================================
CREATE TABLE IF NOT EXISTS `app_logs` (
  `id`         VARCHAR(26) NOT NULL PRIMARY KEY,
  `level`      ENUM('TRACE','DEBUG','INFO','WARN','ERROR','FATAL') NOT NULL,
  `message`    TEXT        NOT NULL,
  `context`    TEXT        DEFAULT NULL,
  `stack`      TEXT        DEFAULT NULL,
  `created_at` DATETIME    NOT NULL DEFAULT NOW(),
  INDEX `app_logs_level_created_idx` (`level`, `created_at`),
  INDEX `app_logs_created_idx` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
