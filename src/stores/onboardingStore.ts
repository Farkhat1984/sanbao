import { create } from "zustand";

interface OnboardingState {
  hasSeenTour: boolean;
  currentStep: number | null;
  startTour: () => void;
  nextStep: () => void;
  completeTour: () => void;
}

const TOUR_STEPS = 4;
const STORAGE_KEY = "leema-onboarding-seen";

export const useOnboardingStore = create<OnboardingState>((set) => ({
  hasSeenTour:
    typeof window !== "undefined"
      ? localStorage.getItem(STORAGE_KEY) === "true"
      : false,
  currentStep: null,

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
