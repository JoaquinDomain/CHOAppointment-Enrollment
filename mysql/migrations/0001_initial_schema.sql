-- CHO Appointment & Enrollment System
-- Migration 0001: baseline MySQL 8.0 schema.
--
-- This migration assumes the target database already exists and that the
-- connection is using it. It never creates or drops a database, and every
-- table is created with IF NOT EXISTS so that it can also be applied to a
-- database that was provisioned from an earlier copy of this schema.
--
-- All timestamps are stored in UTC. The application sets the session time
-- zone to +00:00 and uses DATETIME(6) columns throughout.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS administrators (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'superadmin') NOT NULL DEFAULT 'admin',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  failed_login_count INT UNSIGNED NOT NULL DEFAULT 0,
  locked_until DATETIME(6) NULL,
  last_login_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
    ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_administrators_username (username),
  KEY idx_administrators_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS admin_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  ip_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  user_agent VARCHAR(255) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  last_seen_at DATETIME(6) NULL,
  expires_at DATETIME(6) NOT NULL,
  revoked_at DATETIME(6) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_sessions_token (token_hash),
  KEY idx_admin_sessions_admin (admin_id),
  KEY idx_admin_sessions_expiry (expires_at),
  KEY idx_admin_sessions_revoked (revoked_at),
  CONSTRAINT fk_admin_sessions_admin
    FOREIGN KEY (admin_id) REFERENCES administrators (id)
    ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS laboratory_services (
  id VARCHAR(50) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  name VARCHAR(120) NOT NULL,
  daily_capacity INT UNSIGNED NOT NULL,
  requires_time_slot TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  external_url VARCHAR(500) NULL,
  description VARCHAR(255) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
    ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_laboratory_services_active (is_active),
  CONSTRAINT chk_laboratory_services_capacity CHECK (daily_capacity >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS patients (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100) NULL,
  last_name VARCHAR(100) NOT NULL,
  suffix VARCHAR(10) NULL,
  birthdate DATE NOT NULL,
  gender VARCHAR(20) NOT NULL,
  civil_status VARCHAR(30) NULL,
  residential_address VARCHAR(255) NOT NULL,
  contact_number VARCHAR(20) NOT NULL,
  spouse_name VARCHAR(150) NULL,
  mothers_maiden_name VARCHAR(150) NULL,
  employment_status VARCHAR(50) NULL,
  primary_care_benefit_member TINYINT(1) NOT NULL DEFAULT 0,
  yakap_registered TINYINT(1) NOT NULL DEFAULT 0,
  yakap_facility VARCHAR(150) NULL,
  philhealth_member TINYINT(1) NOT NULL DEFAULT 0,
  philhealth_number VARCHAR(12) NULL,
  philhealth_status VARCHAR(20) NULL,
  facility_household_number VARCHAR(50) NULL,
  pwd TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
    ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_patients_identity (first_name, last_name, birthdate, contact_number),
  KEY idx_patients_full_name (full_name),
  KEY idx_patients_contact (contact_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS appointments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  patient_id BIGINT UNSIGNED NOT NULL,
  service_id VARCHAR(50) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time ENUM('AM', 'PM') NULL,
  consulting_facility VARCHAR(150) NOT NULL,
  status ENUM('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')
    NOT NULL DEFAULT 'scheduled',
  notes VARCHAR(1000) NULL,
  booking_guard VARCHAR(120) CHARACTER SET ascii COLLATE ascii_bin
    GENERATED ALWAYS AS (
      CASE
        WHEN status IN ('scheduled', 'confirmed', 'completed', 'no_show')
          THEN CONCAT(patient_id, ':', service_id, ':', DATE_FORMAT(appointment_date, '%Y%m%d'))
        ELSE NULL
      END
    ) STORED,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
    ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_appointments_public_id (public_id),
  UNIQUE KEY uq_appointments_active_booking (booking_guard),
  KEY idx_appointments_patient (patient_id),
  KEY idx_appointments_service_date (service_id, appointment_date),
  KEY idx_appointments_date_status (appointment_date, status),
  KEY idx_appointments_created (created_at),
  CONSTRAINT fk_appointments_patient
    FOREIGN KEY (patient_id) REFERENCES patients (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_appointments_service
    FOREIGN KEY (service_id) REFERENCES laboratory_services (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS service_daily_capacity (
  service_id VARCHAR(50) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  appointment_date DATE NOT NULL,
  capacity INT UNSIGNED NOT NULL,
  booked_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
    ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (service_id, appointment_date),
  KEY idx_service_daily_capacity_date (appointment_date),
  CONSTRAINT fk_service_daily_capacity_service
    FOREIGN KEY (service_id) REFERENCES laboratory_services (id)
    ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT chk_service_daily_capacity_booked
    CHECK (booked_count <= capacity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS consent_records (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  patient_id BIGINT UNSIGNED NOT NULL,
  appointment_id BIGINT UNSIGNED NOT NULL,
  consent_version VARCHAR(50) NOT NULL,
  accepted_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  ip_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  user_agent VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_consent_records_appointment (appointment_id),
  KEY idx_consent_records_patient (patient_id),
  KEY idx_consent_records_accepted (accepted_at),
  CONSTRAINT fk_consent_records_patient
    FOREIGN KEY (patient_id) REFERENCES patients (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_consent_records_appointment
    FOREIGN KEY (appointment_id) REFERENCES appointments (id)
    ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS appointment_status_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  appointment_id BIGINT UNSIGNED NOT NULL,
  from_status ENUM('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show') NULL,
  to_status ENUM('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show') NOT NULL,
  changed_by_admin_id BIGINT UNSIGNED NULL,
  reason VARCHAR(255) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_status_history_appointment (appointment_id, created_at),
  KEY idx_status_history_admin (changed_by_admin_id),
  CONSTRAINT fk_status_history_appointment
    FOREIGN KEY (appointment_id) REFERENCES appointments (id)
    ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_status_history_admin
    FOREIGN KEY (changed_by_admin_id) REFERENCES administrators (id)
    ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_type ENUM('admin', 'patient', 'system') NOT NULL,
  actor_id BIGINT UNSIGNED NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NULL,
  entity_id VARCHAR(100) NULL,
  ip_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  user_agent VARCHAR(255) NULL,
  request_id VARCHAR(100) NULL,
  metadata JSON NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_audit_logs_created (created_at),
  KEY idx_audit_logs_actor (actor_type, actor_id),
  KEY idx_audit_logs_entity (entity_type, entity_id),
  KEY idx_audit_logs_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  bucket_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  hit_count INT UNSIGNED NOT NULL DEFAULT 0,
  expires_at DATETIME(6) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (bucket_key),
  KEY idx_rate_limit_buckets_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Service catalogue. Capacities can be tuned in MySQL after the first deploy;
-- re-running this seed intentionally does not overwrite daily_capacity.
INSERT INTO laboratory_services
  (id, name, daily_capacity, requires_time_slot, is_active, description)
VALUES
  ('animal-bite', 'Animal Bite Treatment', 150, 0, 1, 'Post-exposure prophylaxis for animal bites'),
  ('consultation', 'Medical Consultation', 50, 0, 1, 'General medical and pediatric consultation'),
  ('surgical-minor', 'Minor Surgery', 10, 0, 1, 'Minor surgical procedures'),
  ('immunization', 'Immunization', 30, 0, 1, 'Vaccination services'),
  ('prenatal', 'Pre-Natal Checkup', 30, 1, 1, '30 slots daily; choose AM or PM'),
  ('health-certificate', 'Health Certificate', 0, 0, 1, 'Issued through the ENVI System'),
  ('tb-consultation', 'TB Consultation', 20, 0, 1, 'Tuberculosis screening and consultation'),
  ('dental', 'Dental Services', 25, 0, 1, 'Dental checkup and procedures'),
  ('family-planning', 'Family Planning', 15, 0, 1, 'Reproductive health services'),
  ('social-hygiene', 'Social Hygiene Clinic', 20, 0, 1, 'STD/HIV screening and treatment'),
  ('drug-testing', 'Drug Testing', 15, 0, 1, 'Drug screening services'),
  ('medical-certificate', 'Medical Certificate', 30, 0, 1, 'Medical certificate issuance')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  requires_time_slot = VALUES(requires_time_slot),
  is_active = VALUES(is_active),
  description = VALUES(description);
