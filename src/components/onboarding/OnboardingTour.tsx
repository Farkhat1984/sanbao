"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, HelpCircle } from "lucide-react";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { useIsMobile } from "@/hooks/useIsMobile";

interface TourStep {
  targetSelector: string;
  /** Mobile-only override for targetSelector */
  mobileTargetSelector?: string;
  title: string;
  description: string;
  position: "top" | "bottom" | "left" | "right";
}

const STEPS: TourStep[] = [
  {
    targetSelector: "[data-tour='plus-menu']",
    title: "Меню функций",
    description:
      "Прикрепите файл, включите веб-поиск, режим размышления, генерируйте картинки и используйте юридические инструменты.",
    position: "top",
  },
  {
    targetSelector: "[data-tour='sidebar']",
    mobileTargetSelector: "[data-tour='sidebar-toggle']",
    title: "Управление чатами",
    description:
      "Создавайте чаты, управляйте AI-агентами под свои задачи и находите нужные диалоги через поиск.",
    position: "right",
  },
  {
    targetSelector: "[data-tour='chat-input']",
    title: "Поле ввода",
    description:
      "Задайте вопрос, попросите составить документ или код — AI откроет результат в панели артефактов справа.",
    position: "top",
  },
  {
    targetSelector: "",
    title: "Готово!",
    description:
      "Вы готовы к работе! Нажмите кнопку \u00AB?\u00BB в правом нижнем углу, чтобы пройти экскурсию снова.",
    position: "top",
  },
];

export function OnboardingTour() {
  const { hasSeenTour, currentStep, startTour, nextStep, completeTour } =
    useOnboardingStore();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const isMobile = useIsMobile();

  // Auto-start tour for first-time users
  useEffect(() => {
    if (!hasSeenTour) {
      const timer = setTimeout(() => startTour(), 1000);
      return () => clearTimeout(timer);
    }
  }, [hasSeenTour, startTour]);

  // Compute target rect when step changes
  useEffect(() => {
    if (currentStep === null) {
      setRect(null);
      return;
    }
    const step = STEPS[currentStep];
    const selector =
      isMobile && step.mobileTargetSelector
        ? step.mobileTargetSelector
        : step.targetSelector;

    if (!selector) {
      setRect(null);
      return;
    }
    const el = document.querySelector(selector);
    if (el) {
      setRect(el.getBoundingClientRect());
    } else {
      setRect(null);
    }
  }, [currentStep, isMobile]);

  const handleNext = useCallback(() => {
    if (currentStep !== null && currentStep >= STEPS.length - 1) {
      completeTour();
    } else {
      nextStep();
    }
  }, [currentStep, nextStep, completeTour]);

  if (currentStep === null) {
    // Only show help button if user hasn't completed the tour yet
    if (hasSeenTour) return null;
    return (
      <button
        onClick={startTour}
        className="fixed bottom-4 right-4 z-50 h-9 w-9 rounded-full bg-surface border border-border shadow-lg flex items-center justify-center text-text-muted hover:text-accent hover:border-accent/30 transition-colors cursor-pointer"
        title="Экскурсия по интерфейсу"
      >
        <HelpCircle className="h-4.5 w-4.5" />
      </button>
    );
  }

  const step = STEPS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;

  // Desktop: position near target element; Mobile: always bottom sheet
  const getTooltipStyle = (): React.CSSProperties => {
    if (isMobile) {
      // Bottom-sheet style on mobile
      return {
        position: "fixed",
        bottom: 24,
        left: 16,
        right: 16,
        transform: "none",
      };
    }

    if (!rect) {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };
    }

    const gap = 12;
    const tooltipWidth = 288; // sm:w-72 = 18rem = 288px
    const vw = window.innerWidth;

    switch (step.position) {
      case "top": {
        let left = rect.left + rect.width / 2;
        // Clamp so tooltip doesn't overflow edges
        left = Math.max(tooltipWidth / 2 + 16, Math.min(left, vw - tooltipWidth / 2 - 16));
        return {
          bottom: window.innerHeight - rect.top + gap,
          left,
          transform: "translateX(-50%)",
        };
      }
      case "bottom": {
        let left = rect.left + rect.width / 2;
        left = Math.max(tooltipWidth / 2 + 16, Math.min(left, vw - tooltipWidth / 2 - 16));
        return {
          top: rect.bottom + gap,
          left,
          transform: "translateX(-50%)",
        };
      }
      case "right":
        return {
          top: rect.top + rect.height / 2,
          left: rect.right + gap,
          transform: "translateY(-50%)",
        };
      case "left":
        return {
          top: rect.top + rect.height / 2,
          right: vw - rect.left + gap,
          transform: "translateY(-50%)",
        };
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100]">
        {/* Overlay */}
        <div
          className="absolute inset-0 bg-black/40"
          onClick={completeTour}
        />

        {/* Spotlight cutout */}
        {rect && (
          <div
            className="absolute rounded-xl ring-4 ring-accent/40 bg-transparent z-[101]"
            style={{
              top: rect.top - 4,
              left: rect.left - 4,
              width: rect.width + 8,
              height: rect.height + 8,
              boxShadow:
                "0 0 0 9999px rgba(0,0,0,0.4)",
            }}
          />
        )}

        {/* Tooltip */}
        <motion.div
          key={currentStep}
          initial={
            isMobile
              ? { opacity: 0, y: 60 }
              : { opacity: 0, scale: 0.9 }
          }
          animate={
            isMobile
              ? { opacity: 1, y: 0 }
              : { opacity: 1, scale: 1 }
          }
          exit={
            isMobile
              ? { opacity: 0, y: 60 }
              : { opacity: 0, scale: 0.9 }
          }
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className={
            isMobile
              ? "fixed z-[102] bg-surface border border-border rounded-2xl shadow-2xl p-5"
              : "absolute z-[102] w-72 bg-surface border border-border rounded-xl shadow-2xl p-4"
          }
          style={getTooltipStyle()}
        >
          {/* Step counter */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-text-muted font-medium">
              {currentStep + 1} / {STEPS.length}
            </span>
            <button
              onClick={completeTour}
              className="h-6 w-6 rounded flex items-center justify-center text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <h4 className={`font-semibold text-text-primary mb-1 ${isMobile ? "text-base" : "text-sm"}`}>
            {step.title}
          </h4>
          <p className={`text-text-secondary leading-relaxed mb-4 ${isMobile ? "text-sm" : "text-xs"}`}>
            {step.description}
          </p>

          <div className="flex items-center justify-between">
            <button
              onClick={completeTour}
              className={`text-text-muted hover:text-text-primary transition-colors cursor-pointer ${isMobile ? "text-sm" : "text-[11px]"}`}
            >
              Пропустить
            </button>
            <button
              onClick={handleNext}
              className={`flex items-center gap-1 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 transition-colors cursor-pointer ${
                isMobile ? "px-5 py-2.5 text-sm" : "px-3 py-1.5 text-xs"
              }`}
            >
              {isLastStep ? "Начать" : "Далее"}
              {!isLastStep && <ChevronRight className={isMobile ? "h-4 w-4" : "h-3 w-3"} />}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
