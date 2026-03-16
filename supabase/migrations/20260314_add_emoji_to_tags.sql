-- Add emoji column to tags table
ALTER TABLE tags ADD COLUMN IF NOT EXISTS emoji TEXT;

-- Update default tags with emojis
-- Skill Level
UPDATE tags SET emoji = '🌱' WHERE name = 'Beginner' AND category = 'Skill Level';
UPDATE tags SET emoji = '📈' WHERE name = 'Intermediate' AND category = 'Skill Level';
UPDATE tags SET emoji = '⭐' WHERE name = 'Advanced' AND category = 'Skill Level';

-- Instruments
UPDATE tags SET emoji = '🎹' WHERE name = 'Piano' AND category = 'Instrument';
UPDATE tags SET emoji = '🎻' WHERE name = 'Violin' AND category = 'Instrument';
UPDATE tags SET emoji = '🎸' WHERE name = 'Guitar' AND category = 'Instrument';
UPDATE tags SET emoji = '🎤' WHERE name = 'Voice' AND category = 'Instrument';
UPDATE tags SET emoji = '🥁' WHERE name = 'Drums' AND category = 'Instrument';
UPDATE tags SET emoji = '🎻' WHERE name = 'Cello' AND category = 'Instrument';
UPDATE tags SET emoji = '🪈' WHERE name = 'Flute' AND category = 'Instrument';
UPDATE tags SET emoji = '🎺' WHERE name = 'Trumpet' AND category = 'Instrument';
UPDATE tags SET emoji = '🎷' WHERE name = 'Clarinet' AND category = 'Instrument';
UPDATE tags SET emoji = '🎷' WHERE name = 'Saxophone' AND category = 'Instrument';

-- Class Type
UPDATE tags SET emoji = '👥' WHERE name = 'Group' AND category = 'Class Type';
UPDATE tags SET emoji = '👤' WHERE name = 'Private' AND category = 'Class Type';
UPDATE tags SET emoji = '📚' WHERE name = 'Theory' AND category = 'Class Type';
UPDATE tags SET emoji = '🎭' WHERE name = 'Performance' AND category = 'Class Type';
UPDATE tags SET emoji = '🎪' WHERE name = 'Recital Prep' AND category = 'Class Type';

-- Space Types
UPDATE tags SET emoji = '🏫' WHERE name = 'Classroom' AND category = 'Space Types';
UPDATE tags SET emoji = '🎨' WHERE name = 'Studio' AND category = 'Space Types';
UPDATE tags SET emoji = '🎭' WHERE name = 'Performance Hall' AND category = 'Space Types';
UPDATE tags SET emoji = '🎵' WHERE name = 'Practice Room' AND category = 'Space Types';
UPDATE tags SET emoji = '🎪' WHERE name = 'Rehearsal Space' AND category = 'Space Types';
UPDATE tags SET emoji = '🎬' WHERE name = 'Auditorium' AND category = 'Space Types';
UPDATE tags SET emoji = '💻' WHERE name = 'Virtual' AND category = 'Space Types';
UPDATE tags SET emoji = '🔄' WHERE name = 'Multipurpose' AND category = 'Space Types';
UPDATE tags SET emoji = '🤝' WHERE name = 'Conference Room' AND category = 'Space Types';
UPDATE tags SET emoji = '📖' WHERE name = 'Library' AND category = 'Space Types';
UPDATE tags SET emoji = '🍽️' WHERE name = 'Cafeteria / Commons' AND category = 'Space Types';
UPDATE tags SET emoji = '🏀' WHERE name = 'Gymnasium' AND category = 'Space Types';
UPDATE tags SET emoji = '🎭' WHERE name = 'Theater' AND category = 'Space Types';
UPDATE tags SET emoji = '🎵' WHERE name = 'Music Room' AND category = 'Space Types';
UPDATE tags SET emoji = '🎺' WHERE name = 'Band Room' AND category = 'Space Types';
UPDATE tags SET emoji = '🎤' WHERE name = 'Choir Room' AND category = 'Space Types';
UPDATE tags SET emoji = '🎻' WHERE name = 'Orchestra Room' AND category = 'Space Types';
UPDATE tags SET emoji = '🎙️' WHERE name = 'Recording Studio' AND category = 'Space Types';
UPDATE tags SET emoji = '🌳' WHERE name = 'Outdoor Space' AND category = 'Space Types';
UPDATE tags SET emoji = '🎬' WHERE name = 'Stage' AND category = 'Space Types';
UPDATE tags SET emoji = '🚪' WHERE name = 'Green Room' AND category = 'Space Types';
UPDATE tags SET emoji = '🏛️' WHERE name = 'Lobby' AND category = 'Space Types';
UPDATE tags SET emoji = '📦' WHERE name = 'Storage Room' AND category = 'Space Types';
UPDATE tags SET emoji = '🏢' WHERE name = 'Office' AND category = 'Space Types';
