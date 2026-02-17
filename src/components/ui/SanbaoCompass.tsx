"use client";

import { motion } from "framer-motion";

type CompassState = "idle" | "loading" | "thinking" | "found";

interface SanbaoCompassProps {
  state?: CompassState;
  size?: number;
  className?: string;
}

const NEEDLE_ANIMATIONS: Record<CompassState, {
  animate: Record<string, number | number[]>;
  transition: Record<string, unknown>;
}> = {
  idle: {
    animate: { rotate: [0, 5, -5, 3, -3, 0] },
    transition: { duration: 4, repeat: Infinity, ease: "easeInOut" },
  },
  loading: {
    animate: { rotate: [0, -45, 45, -30, 30, -15, 15, 0] },
    transition: { duration: 2, repeat: Infinity, ease: "easeInOut" },
  },
  thinking: {
    animate: { rotate: [0, 360] },
    transition: { duration: 3, repeat: Infinity, ease: "linear" },
  },
  found: {
    animate: { rotate: 0 },
    transition: { type: "spring", damping: 8, stiffness: 200 },
  },
};

export function SanbaoCompass({ state = "idle", size = 32, className = "" }: SanbaoCompassProps) {
  const anim = NEEDLE_ANIMATIONS[state];
  const r = size / 2;
  const strokeW = size * 0.06;
  const needleLen = r * 0.6;
  const tickLen = r * 0.12;

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      aria-label="Sanbao compass"
    >
      {/* Outer ring */}
      <circle
        cx={r}
        cy={r}
        r={r - strokeW}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeW}
        opacity={0.2}
      />

      {/* Cardinal ticks */}
      {[0, 90, 180, 270].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        const x1 = r + (r - strokeW * 2) * Math.sin(rad);
        const y1 = r - (r - strokeW * 2) * Math.cos(rad);
        const x2 = r + (r - strokeW * 2 - tickLen) * Math.sin(rad);
        const y2 = r - (r - strokeW * 2 - tickLen) * Math.cos(rad);
        return (
          <line
            key={angle}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="currentColor"
            strokeWidth={strokeW * 0.8}
            opacity={0.3}
            strokeLinecap="round"
          />
        );
      })}

      {/* Center dot */}
      <circle cx={r} cy={r} r={size * 0.06} fill="currentColor" opacity={0.4} />

      {/* Animated needle group */}
      <motion.g
        style={{ originX: `${r}px`, originY: `${r}px` }}
        animate={anim.animate}
        transition={anim.transition}
      >
        {/* North needle (red/accent) */}
        <line
          x1={r}
          y1={r}
          x2={r}
          y2={r - needleLen}
          stroke="var(--accent, #4F6EF7)"
          strokeWidth={strokeW * 1.2}
          strokeLinecap="round"
        />
        {/* South needle (muted) */}
        <line
          x1={r}
          y1={r}
          x2={r}
          y2={r + needleLen * 0.5}
          stroke="currentColor"
          strokeWidth={strokeW * 0.8}
          strokeLinecap="round"
          opacity={0.3}
        />
        {/* North tip diamond */}
        <polygon
          points={`${r},${r - needleLen - size * 0.06} ${r - size * 0.04},${r - needleLen + size * 0.02} ${r + size * 0.04},${r - needleLen + size * 0.02}`}
          fill="var(--accent, #4F6EF7)"
        />
      </motion.g>
    </motion.svg>
  );
}
