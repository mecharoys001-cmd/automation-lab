'use client';

export interface VenueOption {
  id: string;
  name: string;
}

interface VenueToggleProps {
  venues: VenueOption[];
  selectedVenues: string[];
  onChange: (selectedIds: string[]) => void;
  className?: string;
}

const VENUE_COLORS = [
  { bg: '#6B7280', dot: '#6B7280' }, // gray-500
  { bg: '#4B5563', dot: '#4B5563' }, // gray-600
  { bg: '#374151', dot: '#374151' }, // gray-700
  { bg: '#9CA3AF', dot: '#9CA3AF' }, // gray-400
  { bg: '#6B7280', dot: '#6B7280' }, // gray-500 (repeat)
];

export function VenueToggle({
  venues,
  selectedVenues,
  onChange,
  className = '',
}: VenueToggleProps) {
  function handleToggle(venueId: string) {
    if (selectedVenues.includes(venueId)) {
      // Don't allow deselecting the last venue
      if (selectedVenues.length <= 1) return;
      onChange(selectedVenues.filter((id) => id !== venueId));
    } else {
      onChange([...selectedVenues, venueId]);
    }
  }

  return (
    <div className={`flex items-center gap-3 py-3 ${className}`}>
      {venues.map((venue, i) => {
        const isActive = selectedVenues.includes(venue.id);
        const color = VENUE_COLORS[i % VENUE_COLORS.length];

        return (
          <button
            key={venue.id}
            onClick={() => handleToggle(venue.id)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-medium transition-all cursor-pointer ${
              isActive
                ? 'text-white shadow-sm'
                : 'bg-transparent border border-gray-300 text-gray-400'
            }`}
            style={isActive ? { backgroundColor: color.bg } : undefined}
          >
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: isActive ? '#FFFFFF' : color.dot }}
            />
            {venue.name}
          </button>
        );
      })}
    </div>
  );
}
