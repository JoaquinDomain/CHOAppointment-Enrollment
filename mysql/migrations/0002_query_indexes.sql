-- Migration 0002: indexes for the appointment duplicate check and facility
-- filtered listing.
--
-- MySQL 8.0 does not support CREATE INDEX IF NOT EXISTS, so each index is
-- added only when it is absent. The migration is therefore safe to execute
-- more than once, which also makes it safe to re-run manually after a failed
-- deployment. It only adds indexes; it never drops or rewrites data.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- The booking transaction looks up an existing active appointment by
-- (patient_id, service_id, appointment_date). The generated booking_guard
-- unique key protects correctness, but this composite index keeps the
-- SELECT ... FOR UPDATE lookup narrow and avoids scanning all of a patient's
-- appointments.
SET @index_exists := (
  SELECT COUNT(*)
    FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'appointments'
     AND index_name = 'idx_appointments_patient_service_date'
);
SET @ddl := IF(
  @index_exists = 0,
  'ALTER TABLE appointments ADD INDEX idx_appointments_patient_service_date (patient_id, service_id, appointment_date)',
  'DO 0'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- The administrator dashboard filters appointments by consulting facility and
-- date. The existing indexes cover date/status and service/date, but not the
-- facility filter on its own.
SET @index_exists := (
  SELECT COUNT(*)
    FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'appointments'
     AND index_name = 'idx_appointments_facility_date'
);
SET @ddl := IF(
  @index_exists = 0,
  'ALTER TABLE appointments ADD INDEX idx_appointments_facility_date (consulting_facility, appointment_date)',
  'DO 0'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- The dashboard can filter by status without a date. A status-first index
-- covers that case; the existing date-first index cannot.
SET @index_exists := (
  SELECT COUNT(*)
    FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'appointments'
     AND index_name = 'idx_appointments_status_date'
);
SET @ddl := IF(
  @index_exists = 0,
  'ALTER TABLE appointments ADD INDEX idx_appointments_status_date (status, appointment_date)',
  'DO 0'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
