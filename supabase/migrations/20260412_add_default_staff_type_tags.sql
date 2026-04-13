-- Add protected default Staff Type tags to all existing programs

INSERT INTO public.tags (name, color, emoji, category, description, program_id, is_default)
SELECT t.name, t.color, t.emoji, t.category, t.description, p.id, true
FROM public.programs p
CROSS JOIN (
  VALUES
    ('ASAP! TA', '#2563EB', '🧑‍🏫', 'Staff Type', 'ASAP! teaching artist'),
    ('Partner Staff', '#7C3AED', '🤝', 'Staff Type', 'Partner organization staff member'),
    ('ASAP! Staff', '#DB2777', '⭐', 'Staff Type', 'ASAP! staff member')
) AS t(name, color, emoji, category, description)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.tags existing
  WHERE existing.program_id = p.id
    AND existing.category = t.category
    AND existing.name = t.name
);
