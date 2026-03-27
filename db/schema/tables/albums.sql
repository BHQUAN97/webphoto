-- ============================================================
-- TABLE: albums
-- Source: photo-storage/server/src/database/schema.ts
-- ============================================================
CREATE TABLE IF NOT EXISTS `albums` (
  `id`                      VARCHAR(26)  NOT NULL PRIMARY KEY,
  `user_id`                 VARCHAR(26)  NOT NULL,
  `title`                   VARCHAR(200) NOT NULL,
  `description`             TEXT         DEFAULT NULL,
  `cover_key`               VARCHAR(500) DEFAULT NULL,
  `cover_storage_backend`   VARCHAR(10)  DEFAULT NULL,
  `drive_folder_id`         VARCHAR(100) DEFAULT NULL,
  `is_public`               BOOLEAN      NOT NULL DEFAULT TRUE,
  `is_active`               BOOLEAN      NOT NULL DEFAULT TRUE,
  `image_count`             INT          NOT NULL DEFAULT 0,
  `total_bytes`             BIGINT       NOT NULL DEFAULT 0,
  `created_at`              DATETIME     NOT NULL DEFAULT NOW(),
  `updated_at`              DATETIME     NOT NULL DEFAULT NOW(),
  `password_hash`           VARCHAR(255) DEFAULT NULL,
  `expires_at`              DATETIME     DEFAULT NULL,
  `max_favorites`           INT          DEFAULT 20,
  INDEX `albums_user_idx` (`user_id`, `created_at`),
  INDEX `albums_public_idx` (`is_public`, `is_active`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
