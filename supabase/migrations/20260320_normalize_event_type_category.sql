-- Normalize 'Event Type' (singular) to 'Event Types' (plural) for consistency
-- This fixes duplicate categories showing on the Tags admin page
UPDATE tags SET category = 'Event Types' WHERE category = 'Event Type';
