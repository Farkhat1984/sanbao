"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, HelpCircle } from "lucide-react";
import { useOnboardingStore } from "@/stores/onboardingStore";

interface TourStep {
  targetSelector: string;
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
    if (!step.targetSelector) {
      setRect(null);
      return;
    }
    const el = document.querySelector(step.targetSelector);
    if (el) {
      setRect(el.getBoundingClientRect());
    } else {
      setRect(null);
    }
  }, [currentStep]);

  const handleNext = useCallback(() => {
    if (currentStep !== null && currentStep >= STEPS.length - 1) {
      completeTour();
    } else {
      nextStep();
    }
  }, [currentStep, nextStep, completeTour]);

  if (currentStep === null) {
    // Help button to restart tour
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

  // Tooltip position
  const getTooltipStyle = (): React.CSSProperties => {
    if (!rect) {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };
    }

    const gap = 12;
    switch (step.position) {
      case "top":
        return {
          bottom: window.innerHeight - rect.top + gap,
          left: rect.left + rect.width / 2,
          transform: "translateX(-50%)",
        };
      case "bottom":
        return {
          top: rect.bottom + gap,
          left: rect.left + rect.width / 2,
          transform: "translateX(-50%)",
        };
      case "right":
        return {
          top: rect.top + rect.height / 2,
          left: rect.right + gap,
          transform: "translateY(-50%)",
        };
      case "left":
        return {
          top: rect.top + rect.height / 2,
          right: window.innerWidth - rect.left + gap,
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
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="absolute z-[102] w-72 bg-surface border border-border rounded-xl shadow-2xl p-4"
          style={getTooltipStyle()}
        >
          {/* Step counter */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-text-muted font-medium">
              {currentStep + 1} / {STEPS.length}
            </span>
            <button
              onClick={completeTour}
              className="h-5 w-5 rounded flex items-center justify-center text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <h4 className="text-sm font-semibold text-text-primary mb-1">
            {step.title}
          </h4>
          <p className="text-xs text-text-secondary leading-relaxed mb-3">
            {step.description}
          </p>

          <div className="flex items-center justify-between">
            <button
              onClick={completeTour}
              className="text-[11px] text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            >
              Пропустить
            </button>
            <button
              onClick={handleNext}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors cursor-pointer"
            >
              {isLastStep ? "Начать" : "Далее"}
              {!isLastStep && <ChevronRight className="h-3 w-3" />}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
