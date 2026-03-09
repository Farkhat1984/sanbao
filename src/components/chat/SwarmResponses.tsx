"use client";

import { useState } from "react";
import { ChevronRight, Network, Bot } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { SwarmAgentResponse } from "@/stores/chatStore";

interface SwarmResponsesProps {
  responses: SwarmAgentResponse[];
}

/** Collapsible list of swarm agent responses shown below assistant messages. */
export function SwarmResponses({ responses }: SwarmResponsesProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (responses.length === 0) return null;

  return (
    <div className="mt-2 w-full">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-[11px] text-amber-600 hover:text-amber-700 transition-colors cursor-pointer mb-1"
      >
        <Network className="h-3 w-3" />
        <span>Ответы агентов ({responses.length})</span>
        <ChevronRight
          className={cn(
            "h-3 w-3 transition-transform",
            isOpen && "rotate-90"
          )}
        />
      </button>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="space-y-2"
        >
          {responses.map((resp) => (
            <div
              key={resp.id}
              className="rounded-xl bg-amber-500/5 border border-amber-500/15 px-3 py-2"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Bot className="h-3 w-3 text-amber-500" />
                <span className="text-xs font-medium text-text-primary">
                  {resp.name}
                </span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">
                {resp.content}
              </p>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
