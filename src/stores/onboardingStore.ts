import { create } from "zustand";

interface OnboardingState {
  hasSeenTour: boolean;
  _hydrated: boolean;
  currentStep: number | null;
  hydrate: () => void;
  startTour: () => void;
  nextStep: () => void;
  completeTour: () => void;
}

const TOUR_STEPS = 4;
const STORAGE_KEY = "sanbao-onboarding-seen";

export const useOnboardingStore = create<OnboardingState>((set) => ({
  // Initialize with false to avoid SSR/hydration mismatch; hydrate on mount
  hasSeenTour: false,
  _hydrated: false,
  currentStep: null,

  hydrate: () => set((s) => {
    if (s._hydrated) return {};
    const seen = typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY) === "true";
    return { hasSeenTour: seen, _hydrated: true };
  }),

  startTour: () => set({ currentStep: 0 }),

  nextStep: () =>
    set((s) => {
      if (s.currentStep === null) return {};
      const next = s.currentStep + 1;
      if (next >= TOUR_STEPS) {
        localStorage.setItem(STORAGE_KEY, "true");
        return { currentStep: null, hasSeenTour: true };
      }
      return { currentStep: next };
    }),

  completeTour: () => {
    localStorage.setItem(STORAGE_KEY, "true");
    return set({ currentStep: null, hasSeenTour: true });
  },
}));
