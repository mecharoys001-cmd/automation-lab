-- Seed default Venue Tags
-- Run this after 003_add_venue_tags.sql migration

-- Insert Venue Tags (location/space characteristics)
INSERT INTO tags (name, emoji, category, description) VALUES
  ('indoor', '🏢', 'Venue Tags', 'Indoor venue or space'),
  ('outdoor', '🌳', 'Venue Tags', 'Outdoor venue or space')
ON CONFLICT (name) DO NOTHING;
