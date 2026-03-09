"use client";

import { useState } from "react";
import { Brain, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ReasoningBlockProps {
  reasoning: string;
}

/** Collapsible "reasoning / thinking" block shown above assistant messages. */
export function ReasoningBlock({ reasoning }: ReasoningBlockProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mb-2 w-full">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-[11px] text-legal-ref hover:text-[#A07D55] transition-colors cursor-pointer mb-1"
      >
        <Brain className="h-3 w-3" />
        <span>Ход мысли</span>
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="rounded-xl bg-legal-ref-bg border border-legal-ref/20 px-3 py-2 text-xs text-legal-ref leading-relaxed max-h-[300px] overflow-y-auto"
        >
          <pre className="whitespace-pre-wrap font-sans">
            {reasoning}
          </pre>
        </motion.div>
      )}
    </div>
  );
}
