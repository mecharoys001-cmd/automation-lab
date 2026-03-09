#!/bin/bash
# Seed default Space Type tags for the scheduler

PRODUCTION_URL="https://tools.artsnwct.org"

echo "🏷️  Seeding Space Type tags..."

curl -X POST "$PRODUCTION_URL/api/import/seed-data" \
  -H "Content-Type: application/json" \
  -d '{
    "tags": [
      {
        "name": "Classroom",
        "category": "Space Types",
        "emoji": "📚",
        "description": "Standard classroom for instruction"
      },
      {
        "name": "Stage",
        "category": "Space Types",
        "emoji": "🎭",
        "description": "Performance stage or theater space"
      },
      {
        "name": "Auditorium",
        "category": "Space Types",
        "emoji": "🎪",
        "description": "Large assembly or performance hall"
      },
      {
        "name": "Studio",
        "category": "Space Types",
        "emoji": "🎨",
        "description": "Art, music, or dance studio"
      },
      {
        "name": "Outdoor Space",
        "category": "Space Types",
        "emoji": "🌳",
        "description": "Outdoor venue or field"
      },
      {
        "name": "Virtual",
        "category": "Space Types",
        "emoji": "💻",
        "description": "Online or remote venue"
      },
      {
        "name": "Multipurpose",
        "category": "Space Types",
        "emoji": "🏢",
        "description": "Flexible multi-use space"
      }
    ]
  }'

echo ""
echo "✅ Done! Space Type tags have been seeded."
