"use client";

interface CompassRoseProps {
  size?: number;
  className?: string;
  opacity?: number;
}

/** Decorative 8-pointed compass rose for backgrounds and watermarks. */
export function CompassRose({
  size = 200,
  className = "",
  opacity = 0.05,
}: CompassRoseProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ opacity }}
    >
      {/* Outer circle */}
      <circle cx="100" cy="100" r="95" strokeWidth={1.5} />

      {/* Inner circle */}
      <circle cx="100" cy="100" r="70" strokeWidth={0.75} />

      {/* Cardinal points (4 main triangles) */}
      {/* North */}
      <polygon points="100,8 88,70 112,70" fill="currentColor" stroke="currentColor" strokeWidth={0.5} />
      <polygon points="100,8 88,130 112,130" fill="none" stroke="currentColor" strokeWidth={0.5} opacity={0.3} />
      {/* South */}
      <polygon points="100,192 88,130 112,130" fill="currentColor" stroke="currentColor" strokeWidth={0.5} />
      <polygon points="100,192 88,70 112,70" fill="none" stroke="currentColor" strokeWidth={0.5} opacity={0.3} />
      {/* East */}
      <polygon points="192,100 130,88 130,112" fill="currentColor" stroke="currentColor" strokeWidth={0.5} />
      <polygon points="192,100 70,88 70,112" fill="none" stroke="currentColor" strokeWidth={0.5} opacity={0.3} />
      {/* West */}
      <polygon points="8,100 70,88 70,112" fill="currentColor" stroke="currentColor" strokeWidth={0.5} />
      <polygon points="8,100 130,88 130,112" fill="none" stroke="currentColor" strokeWidth={0.5} opacity={0.3} />

      {/* Intercardinal points (4 secondary triangles) */}
      {/* NE */}
      <polygon points="167,33 118,82 136,64" fill="currentColor" stroke="currentColor" strokeWidth={0.5} />
      {/* SE */}
      <polygon points="167,167 118,118 136,136" fill="currentColor" stroke="currentColor" strokeWidth={0.5} />
      {/* SW */}
      <polygon points="33,167 82,118 64,136" fill="currentColor" stroke="currentColor" strokeWidth={0.5} />
      {/* NW */}
      <polygon points="33,33 82,82 64,64" fill="currentColor" stroke="currentColor" strokeWidth={0.5} />

      {/* Center decoration */}
      <circle cx="100" cy="100" r="8" fill="currentColor" stroke="currentColor" />
      <circle cx="100" cy="100" r="3" fill="none" stroke="currentColor" strokeWidth={2} opacity={0.5} />
    </svg>
  );
}
