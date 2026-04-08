'use client';

import React from 'react';

interface RichNotesProps {
  text: string | null | undefined;
  className?: string;
}

/**
 * Renders text with markdown-style links [text](url) and auto-linked bare URLs.
 * Links open in new tabs with security attributes.
 */
export function RichNotes({ text, className = '' }: RichNotesProps) {
  if (!text) return null;

  // Match [text](url) or bare https:// URLs
  const parts = text.split(/(\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s<>"{}|\\^`[\]]+)/g);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        // Markdown link: [text](url)
        const mdMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (mdMatch) {
          return (
            <a
              key={i}
              href={mdMatch[2]}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline hover:text-blue-800 transition-colors"
            >
              {mdMatch[1]}
            </a>
          );
        }

        // Bare URL
        if (/^https?:\/\//.test(part)) {
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline hover:text-blue-800 transition-colors"
            >
              {part}
            </a>
          );
        }

        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </span>
  );
}
