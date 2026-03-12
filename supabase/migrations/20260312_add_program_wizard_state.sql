-- Add per-program onboarding wizard tracking
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS wizard_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wizard_step integer NOT NULL DEFAULT 0;
