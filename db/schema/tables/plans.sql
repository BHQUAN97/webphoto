-- ============================================================
-- TABLE: plans
-- Source: photo-storage/server/src/database/schema.ts
-- ============================================================
CREATE TABLE IF NOT EXISTS `plans` (
  `id`             VARCHAR(26)  NOT NULL PRIMARY KEY,
  `code`           VARCHAR(50)  NOT NULL,
  `name`           VARCHAR(100) NOT NULL,
  `price_vnd`      INT          NOT NULL DEFAULT 0,
  `duration_days`  INT          NOT NULL,
  `quota_bytes`    BIGINT       NOT NULL,
  `max_albums`     INT          DEFAULT NULL,
  `can_download`   BOOLEAN      NOT NULL DEFAULT FALSE,
  `can_filter`     BOOLEAN      NOT NULL DEFAULT FALSE,
  `can_edit_photo` BOOLEAN      NOT NULL DEFAULT FALSE,
  `is_active`      BOOLEAN      NOT NULL DEFAULT TRUE,
  `sort_order`     INT          NOT NULL DEFAULT 0,
  UNIQUE KEY (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
