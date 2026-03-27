-- ============================================================
-- TABLE: images
-- Source: photo-storage/server/src/database/schema.ts
-- ============================================================
CREATE TABLE IF NOT EXISTS `images` (
  `id`               VARCHAR(26)  NOT NULL PRIMARY KEY,
  `album_id`         VARCHAR(26)  NOT NULL,
  `user_id`          VARCHAR(26)  NOT NULL,
  `original_key`     VARCHAR(500) NOT NULL,
  `thumb_key`        VARCHAR(500) DEFAULT NULL,
  `preview_key`      VARCHAR(500) DEFAULT NULL,
  `storage_backend`  VARCHAR(10)  NOT NULL DEFAULT 'r2',
  `drive_file_id`    VARCHAR(100) DEFAULT NULL,
  `original_name`    VARCHAR(255) NOT NULL,
  `mime_type`        VARCHAR(100) NOT NULL,
  `original_size`    BIGINT       NOT NULL,
  `width`            INT          DEFAULT NULL,
  `height`           INT          DEFAULT NULL,
  `status`           ENUM('uploading','processing','ready','failed','syncing') NOT NULL DEFAULT 'uploading',
  `like_count`       INT          NOT NULL DEFAULT 0,
  `comment_count`    INT          NOT NULL DEFAULT 0,
  `expires_at`       DATETIME     NOT NULL,
  `created_at`       DATETIME     NOT NULL DEFAULT NOW(),
  INDEX `images_album_created_idx` (`album_id`, `created_at`),
  INDEX `images_user_created_idx` (`user_id`, `created_at`),
  INDEX `images_expiry_idx` (`expires_at`, `status`),
  INDEX `images_status_idx` (`status`, `created_at`),
  INDEX `images_album_like_idx` (`album_id`, `like_count`),
  INDEX `images_album_size_idx` (`album_id`, `original_size`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
