import type { Variants, Transition } from "framer-motion";

// ─── Transitions ─────────────────────────────────────────

export const springTransition: Transition = {
  type: "spring",
  damping: 20,
  stiffness: 200,
};

export const smoothTransition: Transition = {
  duration: 0.3,
  ease: [0.25, 0.1, 0.25, 1],
};

export const fastTransition: Transition = {
  duration: 0.15,
  ease: "easeOut",
};

// ─── Page / Section Variants ────────────────────────────

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4, ease: "easeOut" } },
};

export const fadeScale: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: springTransition },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0, transition: smoothTransition },
  exit: { opacity: 0, x: 24, transition: fastTransition },
};

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -24 },
  visible: { opacity: 1, x: 0, transition: smoothTransition },
  exit: { opacity: 0, x: -24, transition: fastTransition },
};

// ─── List / Stagger Variants ────────────────────────────

export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

export const staggerContainerSlow: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: smoothTransition },
};

// ─── Modal / Panel Variants ─────────────────────────────

export const modalOverlay: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export const modalContent: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0, transition: springTransition },
  exit: { opacity: 0, scale: 0.95, y: 8, transition: fastTransition },
};

export const panelSlide: Variants = {
  hidden: { x: "100%" },
  visible: { x: 0, transition: { type: "spring", damping: 25, stiffness: 300 } },
  exit: { x: "100%", transition: { duration: 0.2, ease: "easeIn" } },
};

// ─── Card Hover (use with whileHover) ───────────────────

export const cardHover = {
  y: -2,
  transition: fastTransition,
};

export const cardTap = {
  scale: 0.98,
  transition: { duration: 0.1 },
};

// ─── Utility ────────────────────────────────────────────

export const reducedMotion: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.01 } },
};
