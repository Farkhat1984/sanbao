"use client";

import { motion } from "framer-motion";

type CompassState = "idle" | "loading" | "thinking" | "found";

interface SanbaoCompassProps {
  state?: CompassState;
  size?: number;
  className?: string;
}

export function SanbaoCompass({ state = "idle", size = 32, className = "" }: SanbaoCompassProps) {
  const getNeedleAnimation = () => {
    switch (state) {
      case "idle":
        return {
          animate: { rotate: [0, 8, -8, 5, -5, 0] },
          transition: { duration: 4, repeat: Infinity, ease: "easeInOut" as const },
        };
      case "loading":
        return {
          animate: { rotate: [0, -30, 30, -20, 20, -10, 10, 0] },
          transition: { duration: 2, repeat: Infinity, ease: "easeInOut" as const },
        };
      case "thinking":
        return {
          animate: { rotate: [0, 360] },
          transition: { duration: 3, repeat: Infinity, ease: "linear" as const },
        };
      case "found":
        return {
          animate: { rotate: 0 },
          transition: { type: "spring" as const, damping: 8, stiffness: 200 },
        };
    }
  };

  const anim = getNeedleAnimation();
  const r = size / 2;
  const sw = Math.max(size * 0.07, 1.2);

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
        r={r - sw}
        fill="none"
        stroke="currentColor"
        strokeWidth={sw}
        opacity={0.5}
      />

      {/* Animated needle group */}
      <motion.g
        style={{ originX: `${r}px`, originY: `${r}px` }}
        animate={anim.animate}
        transition={anim.transition}
      >
        {/* North needle (triangle pointing up) */}
        <polygon
          points={`${r},${r * 0.28} ${r - r * 0.22},${r} ${r + r * 0.22},${r}`}
          fill="currentColor"
        />
        {/* South needle (muted triangle pointing down) */}
        <polygon
          points={`${r},${r * 1.72} ${r - r * 0.16},${r} ${r + r * 0.16},${r}`}
          fill="currentColor"
          opacity={0.35}
        />
      </motion.g>

      {/* Center dot */}
      <circle cx={r} cy={r} r={Math.max(size * 0.07, 1)} fill="currentColor" opacity={0.7} />
    </motion.svg>
  );
}
