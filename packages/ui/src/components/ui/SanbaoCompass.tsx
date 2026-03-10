interface SanbaoCompassProps {
  size?: number;
  className?: string;
}

export function SanbaoCompass({ size = 32, className = "" }: SanbaoCompassProps) {
  const r = size / 2;
  const sw = Math.max(size * 0.07, 1.2);
  const dot = Math.max(size * 0.09, 1.2);
  const gap = dot + 0.5;

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
      <polygon
        points={`${r},${r * 0.28} ${r - r * 0.22},${r - gap} ${r + r * 0.22},${r - gap}`}
        fill="currentColor"
      />
      <polygon
        points={`${r},${r * 1.72} ${r - r * 0.16},${r + gap} ${r + r * 0.16},${r + gap}`}
        fill="#B8956A"
      />
      <circle cx={r} cy={r} r={dot} fill="currentColor" />
    </svg>
  );
}
