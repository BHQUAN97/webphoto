-- ============================================================
-- TABLE: storage_snapshots
-- Source: photo-storage/server/src/database/schema.ts
-- ============================================================
CREATE TABLE IF NOT EXISTS `storage_snapshots` (
  `id`                  VARCHAR(26) NOT NULL PRIMARY KEY,
  `total_bytes_private` BIGINT      NOT NULL,
  `total_bytes_public`  BIGINT      NOT NULL,
  `total_users`         INT         NOT NULL,
  `total_images`        INT         NOT NULL,
  `total_albums`        INT         NOT NULL,
  `new_users_today`     INT         NOT NULL DEFAULT 0,
  `revenue_today`       INT         NOT NULL DEFAULT 0,
  `visit_count`         INT         NOT NULL DEFAULT 0,
  `snapshot_at`         DATETIME    NOT NULL DEFAULT NOW(),
  INDEX `storage_snapshots_time_idx` (`snapshot_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
