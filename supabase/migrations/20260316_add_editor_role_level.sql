-- Add 'editor' to role_level enum
ALTER TYPE role_level ADD VALUE IF NOT EXISTS 'editor';
