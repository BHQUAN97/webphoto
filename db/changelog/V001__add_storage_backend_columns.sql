-- ============================================================
-- V001: Add per-image storage backend tracking
-- Date:   2026-03-27
-- Author: Agent_DBO
-- Ticket: per-image storage backend feature
-- ============================================================
-- Cho phep moi anh luu storage_backend rieng (r2/local).
-- Khi chuyen backend, anh cu van load dung provider.
-- ============================================================

-- 1. images.storage_backend (VARCHAR 10, NOT NULL, DEFAULT 'r2')
SET @sql = (
    SELECT IF(
        EXISTS (
            SELECT 1
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'images'
              AND COLUMN_NAME = 'storage_backend'
        ),
        'SELECT ''[SKIP] images.storage_backend already exists'' AS info;',
        'ALTER TABLE images ADD COLUMN storage_backend VARCHAR(10) NOT NULL DEFAULT ''r2'';'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. albums.cover_storage_backend (VARCHAR 10, NULL)
SET @sql = (
    SELECT IF(
        EXISTS (
            SELECT 1
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'albums'
              AND COLUMN_NAME = 'cover_storage_backend'
        ),
        'SELECT ''[SKIP] albums.cover_storage_backend already exists'' AS info;',
        'ALTER TABLE albums ADD COLUMN cover_storage_backend VARCHAR(10) NULL;'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verify
SELECT CONCAT('[OK] ', TABLE_NAME, '.', COLUMN_NAME, ' (', COLUMN_TYPE, ')') AS result
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND (
    (TABLE_NAME = 'images'  AND COLUMN_NAME = 'storage_backend')
    OR (TABLE_NAME = 'albums' AND COLUMN_NAME = 'cover_storage_backend')
  )
ORDER BY TABLE_NAME;
