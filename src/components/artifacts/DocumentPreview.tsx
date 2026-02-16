"use client";

import { forwardRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface DocumentPreviewProps {
  content: string;
}

export const DocumentPreview = forwardRef<HTMLDivElement, DocumentPreviewProps>(
  ({ content }, ref) => {
    return (
      <div ref={ref} className="p-2 md:p-6 flex justify-center bg-surface-alt/50">
        <div className="w-full md:max-w-[210mm] bg-white dark:bg-[#1a1a2e] md:shadow-lg md:border md:border-border md:rounded-lg">
          <div className="px-4 py-4 md:px-[20mm] md:py-[15mm] md:min-h-[297mm] prose-legal max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    );
  }
);

DocumentPreview.displayName = "DocumentPreview";
