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
      <div ref={ref} className="p-6 flex justify-center bg-surface-alt/50">
        <div className="w-full max-w-[210mm] bg-white dark:bg-[#1a1a2e] shadow-lg border border-border rounded-lg">
          <div className="px-[20mm] py-[15mm] min-h-[297mm] prose-legal max-w-none">
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
