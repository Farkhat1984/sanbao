interface SanbaoCompassProps {
  size?: number;
  className?: string;
}

export function SanbaoCompass({ size = 32, className = "" }: SanbaoCompassProps) {
  const r = size / 2;
  const sw = Math.max(size * 0.07, 1.2);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      aria-label="Sanbao compass"
    >
      <circle
        cx={r}
        cy={r}
        r={r - sw}
        fill="none"
        stroke="currentColor"
        strokeWidth={sw}
        opacity={0.5}
      />

      <g>
        <polygon
          points={`${r},${r * 0.28} ${r - r * 0.22},${r} ${r + r * 0.22},${r}`}
          fill="currentColor"
        />
        <polygon
          points={`${r},${r * 1.72} ${r - r * 0.16},${r} ${r + r * 0.16},${r}`}
          fill="#B8956A"
        />
      </g>

      <circle cx={r} cy={r} r={Math.max(size * 0.07, 1)} fill="currentColor" opacity={0.7} />
    </svg>
  );
}
