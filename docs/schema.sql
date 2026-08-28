-- CHO Appointment System Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create appointments table
CREATE TABLE IF NOT EXISTS appointments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Patient Information
  full_name TEXT NOT NULL,
  age INTEGER NOT NULL,
  birthdate DATE,
  gender TEXT,
  civil_status TEXT,
  residential_address TEXT,
  contact_number TEXT,
  spouse_name TEXT,
  mothers_maiden_name TEXT,
  employment_status TEXT,
  primary_care_benefit_member BOOLEAN DEFAULT FALSE,
  
  -- Health Facility Information
  consulting_facility TEXT NOT NULL,
  yakap_registered BOOLEAN NOT NULL DEFAULT FALSE,
  yakap_facility TEXT,
  
  -- Service Selection
  service_type TEXT NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TEXT, -- AM or PM for services that need it
  
  -- Program & Coverage
  philhealth_member BOOLEAN DEFAULT FALSE,
  philhealth_number TEXT,
  philhealth_status TEXT,
  facility_household_number TEXT,
  pwd BOOLEAN DEFAULT FALSE,
  
  -- Consent
  data_privacy_consent BOOLEAN DEFAULT FALSE,
  
  -- Additional Notes
  notes TEXT
);

-- Create index on appointment_date for faster queries
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_facility ON appointments(consulting_facility);
CREATE INDEX IF NOT EXISTS idx_appointments_service ON appointments(service_type);

-- Enable Row Level Security
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public users to insert appointments
CREATE POLICY "Allow public insert"
ON appointments
FOR INSERT
TO anon
WITH CHECK (true);

-- Policy: Allow authenticated users (admin) to select all appointments
CREATE POLICY "Allow authenticated select"
ON appointments
FOR SELECT
TO authenticated
USING (true);

-- Policy: Allow authenticated users to update appointments
CREATE POLICY "Allow authenticated update"
ON appointments
FOR UPDATE
TO authenticated
USING (true);

-- Policy: Allow authenticated users to delete appointments
CREATE POLICY "Allow authenticated delete"
ON appointments
FOR DELETE
TO authenticated
USING (true);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_appointments_updated_at
BEFORE UPDATE ON appointments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();