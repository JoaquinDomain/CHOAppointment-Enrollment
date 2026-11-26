-- Migration 0003: administrator RBAC metadata.
--
-- The administrators table already stores role and activation state. This
-- migration only adds an optional display name and an index that supports the
-- super administrator guard reads. Every statement is guarded so the file is
-- safe to execute more than once. Existing rows are preserved and keep the
-- default role of "admin".

SET NAMES utf8mb4;
SET time_zone = '+00:00';

SET @column_exists := (
  SELECT COUNT(*)
    FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'administrators'
     AND column_name = 'display_name'
);
SET @ddl := IF(
  @column_exists = 0,
  'ALTER TABLE administrators ADD COLUMN display_name VARCHAR(150) NULL AFTER username',
  'DO 0'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists := (
  SELECT COUNT(*)
    FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'administrators'
     AND index_name = 'idx_administrators_role_active'
);
SET @ddl := IF(
  @index_exists = 0,
  'ALTER TABLE administrators ADD INDEX idx_administrators_role_active (role, is_active)',
  'DO 0'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
