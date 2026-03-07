"use client";

interface IconProps {
  size?: number;
  className?: string;
}

/** Scroll/parchment roll icon for legal documents. */
export function ScrollIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Top roll */}
      <path d="M6 3 C6 3, 4 3, 4 4.5 C4 6, 6 6, 6 6 L18 6 C18 6, 20 6, 20 4.5 C20 3, 18 3, 18 3 Z" />
      {/* Parchment body */}
      <path d="M6 6 L6 19 C6 19, 6 21, 8 21 L20 21 C20 21, 20 19, 18 19 L18 6" />
      {/* Bottom roll curl */}
      <path d="M6 19 C6 19, 4 19, 4 20 C4 21, 6 21, 8 21" />
      {/* Text lines */}
      <line x1="9" y1="10" x2="15" y2="10" opacity={0.5} />
      <line x1="9" y1="13" x2="16" y2="13" opacity={0.5} />
      <line x1="9" y1="16" x2="13" y2="16" opacity={0.5} />
    </svg>
  );
}
