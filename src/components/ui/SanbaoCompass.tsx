"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

type CompassState = "idle" | "loading" | "thinking" | "found";

interface SanbaoCompassProps {
  state?: CompassState;
  size?: number;
  className?: string;
}

// Kaaba, Mecca
const MECCA_LAT = 21.4225;
const MECCA_LNG = 39.8262;

// Default fallback: Almaty, Kazakhstan
const DEFAULT_LAT = 43.2389;
const DEFAULT_LNG = 76.9453;

function calculateQibla(lat: number, lng: number): number {
  const phi1 = (lat * Math.PI) / 180;
  const phi2 = (MECCA_LAT * Math.PI) / 180;
  const dLambda = ((MECCA_LNG - lng) * Math.PI) / 180;

  const x = Math.sin(dLambda);
  const y = Math.cos(phi1) * Math.tan(phi2) - Math.sin(phi1) * Math.cos(dLambda);

  let bearing = (Math.atan2(x, y) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

export function SanbaoCompass({ state = "idle", size = 32, className = "" }: SanbaoCompassProps) {
  const [qibla, setQibla] = useState(() => calculateQibla(DEFAULT_LAT, DEFAULT_LNG));

  // Determine user location: IP geolocation first, then browser API if already granted
  useEffect(() => {
    let cancelled = false;

    // 1. Try IP-based geolocation (no permission needed, works everywhere)
    fetch("https://ip-api.com/json/?fields=lat,lon", { signal: AbortSignal.timeout(3000) })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && typeof data.lat === "number" && typeof data.lon === "number") {
          setQibla(calculateQibla(data.lat, data.lon));
        }
      })
      .catch(() => {});

    // 2. If browser geolocation already granted — use precise coords (overrides IP)
    navigator?.permissions
      ?.query({ name: "geolocation" })
      .then((result) => {
        if (result.state === "granted") {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (!cancelled) {
                setQibla(calculateQibla(pos.coords.latitude, pos.coords.longitude));
              }
            },
            () => {},
            { maximumAge: 86400000, timeout: 5000 }
          );
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, []);

  const q = qibla;

  const getNeedleAnimation = () => {
    switch (state) {
      case "idle":
        return {
          animate: { rotate: [q, q + 5, q - 5, q + 3, q - 3, q] },
          transition: { duration: 4, repeat: Infinity, ease: "easeInOut" as const },
        };
      case "loading":
        return {
          animate: { rotate: [q, q - 45, q + 45, q - 30, q + 30, q - 15, q + 15, q] },
          transition: { duration: 2, repeat: Infinity, ease: "easeInOut" as const },
        };
      case "thinking":
        return {
          animate: { rotate: [q, q + 360] },
          transition: { duration: 3, repeat: Infinity, ease: "linear" as const },
        };
      case "found":
        return {
          animate: { rotate: q },
          transition: { type: "spring" as const, damping: 8, stiffness: 200 },
        };
    }
  };

  const anim = getNeedleAnimation();
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
        opacity={0.35}
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
            opacity={0.5}
            strokeLinecap="round"
          />
        );
      })}

      {/* Center dot */}
      <circle cx={r} cy={r} r={size * 0.07} fill="currentColor" opacity={0.6} />

      {/* Animated needle group */}
      <motion.g
        style={{ originX: `${r}px`, originY: `${r}px` }}
        animate={anim.animate}
        transition={anim.transition}
      >
        {/* Qibla needle */}
        <line
          x1={r}
          y1={r}
          x2={r}
          y2={r - needleLen}
          stroke="currentColor"
          strokeWidth={strokeW * 1.4}
          strokeLinecap="round"
        />
        {/* Opposite needle (muted) */}
        <line
          x1={r}
          y1={r}
          x2={r}
          y2={r + needleLen * 0.5}
          stroke="currentColor"
          strokeWidth={strokeW * 0.8}
          strokeLinecap="round"
          opacity={0.35}
        />
        {/* Tip diamond */}
        <polygon
          points={`${r},${r - needleLen - size * 0.08} ${r - size * 0.05},${r - needleLen + size * 0.02} ${r + size * 0.05},${r - needleLen + size * 0.02}`}
          fill="currentColor"
        />
      </motion.g>
    </motion.svg>
  );
}
