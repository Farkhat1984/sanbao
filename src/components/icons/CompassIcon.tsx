"use client";

interface IconProps {
  size?: number;
  className?: string;
}

/** Static compass brand mark with cardinal points and north needle. */
export function CompassIcon({ size = 24, className = "" }: IconProps) {
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
      {/* Outer circle */}
      <circle cx="12" cy="12" r="10" />

      {/* Cardinal tick marks */}
      {/* North */}
      <line x1="12" y1="2" x2="12" y2="4.5" />
      {/* South */}
      <line x1="12" y1="19.5" x2="12" y2="22" />
      {/* East */}
      <line x1="19.5" y1="12" x2="22" y2="12" />
      {/* West */}
      <line x1="2" y1="12" x2="4.5" y2="12" />

      {/* North needle (filled triangle) */}
      <polygon
        points="12,5 10,12 14,12"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={0.5}
      />

      {/* South needle (outline) */}
      <polygon
        points="12,19 10,12 14,12"
        fill="none"
        stroke="currentColor"
        strokeWidth={0.5}
      />

      {/* Center dot */}
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}
