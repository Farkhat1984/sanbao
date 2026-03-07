"use client";

interface IconProps {
  size?: number;
  className?: string;
}

/** Ship's wheel icon for settings and control. */
export function ShipWheelIcon({ size = 24, className = "" }: IconProps) {
  const cx = 12;
  const cy = 12;
  const outerR = 9;
  const innerR = 5;
  const handleLen = 2;
  const spokeCount = 8;

  const spokes: Array<{ x1: number; y1: number; x2: number; y2: number; hx: number; hy: number }> = [];

  for (let i = 0; i < spokeCount; i++) {
    const angle = (i * 2 * Math.PI) / spokeCount - Math.PI / 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    spokes.push({
      x1: cx + innerR * cos,
      y1: cy + innerR * sin,
      x2: cx + outerR * cos,
      y2: cy + outerR * sin,
      hx: cx + (outerR + handleLen) * cos,
      hy: cy + (outerR + handleLen) * sin,
    });
  }

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
      {/* Outer ring */}
      <circle cx={cx} cy={cy} r={outerR} />
      {/* Inner ring */}
      <circle cx={cx} cy={cy} r={innerR} />
      {/* Center hub */}
      <circle cx={cx} cy={cy} r={1.5} fill="currentColor" />

      {/* Spokes + handles */}
      {spokes.map((s, i) => (
        <g key={i}>
          <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />
          <line x1={s.x2} y1={s.y2} x2={s.hx} y2={s.hy} strokeWidth={2.5} />
        </g>
      ))}
    </svg>
  );
}
