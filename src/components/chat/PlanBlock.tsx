"use client";

import { useState } from "react";
import { ListChecks, ChevronDown, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface PlanBlockProps {
  content: string;
  isStreaming?: boolean;
}

export function PlanBlock({ content, isStreaming }: PlanBlockProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="mb-2 w-full">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-[11px] text-amber-500 hover:text-amber-600 transition-colors cursor-pointer mb-1"
      >
        <ListChecks className="h-3 w-3" />
        <span>План</span>
        {isStreaming && <Loader2 className="h-3 w-3 animate-spin" />}
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
          className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 leading-relaxed max-h-[300px] overflow-y-auto"
        >
          <div className="prose-leema">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </div>
        </motion.div>
      )}
    </div>
  );
}
