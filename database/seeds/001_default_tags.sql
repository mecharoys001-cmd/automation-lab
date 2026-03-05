-- Seed default tags for Skills and Subjects
-- Run this after 002_add_tag_categories.sql migration

-- Insert Skills tags (instructor competencies)
INSERT INTO tags (name, emoji, category, description) VALUES
  ('Percussion', '🥁', 'Skills', 'Drum sets, timpani, and mallet instruments'),
  ('Strings', '🎻', 'Skills', 'Violin, viola, cello, and bass'),
  ('Brass', '🎺', 'Skills', 'Trumpet, trombone, and horn sections'),
  ('Woodwind', '🪈', 'Skills', 'Flute, clarinet, and oboe'),
  ('Piano', '🎹', 'Skills', 'Piano and keyboard instruction'),
  ('Guitar', '🎸', 'Skills', 'Acoustic and electric guitar'),
  ('Choral', '🎤', 'Skills', 'Voice training and choir direction'),
  ('General Music', '🎵', 'Skills', 'General music education and theory')
ON CONFLICT (name) DO NOTHING;

-- Insert Subject tags (class types)
INSERT INTO tags (name, emoji, category, description) VALUES
  ('Instrumental', '🎼', 'Subject', 'Instrumental music classes'),
  ('Vocal', '🎤', 'Subject', 'Voice and choral music'),
  ('Theory', '📖', 'Subject', 'Music theory and composition'),
  ('Performance', '🌟', 'Subject', 'Recitals and showcases'),
  ('Ensemble', '👥', 'Subject', 'Group performance classes')
ON CONFLICT (name) DO NOTHING;

-- Insert Event Type tags
INSERT INTO tags (name, emoji, category, description) VALUES
  ('Field Trip', '🎭', 'Event Type', 'Off-site musical excursions'),
  ('Guest Artist', '⭐', 'Event Type', 'Special guest performances'),
  ('Showcase', '🌟', 'Event Type', 'Student performance events'),
  ('Workshop', '🛠️', 'Event Type', 'Skill-building workshops'),
  ('Rehearsal', '🎹', 'Event Type', 'Practice and preparation sessions')
ON CONFLICT (name) DO NOTHING;

-- Insert Administrative tags
INSERT INTO tags (name, emoji, category, description) VALUES
  ('TA Check-In', '📋', 'Administrative', 'Teaching assistant coordination'),
  ('Setup/Teardown', '🔧', 'Administrative', 'Equipment preparation'),
  ('Assessment', '📝', 'Administrative', 'Student evaluation sessions')
ON CONFLICT (name) DO NOTHING;
