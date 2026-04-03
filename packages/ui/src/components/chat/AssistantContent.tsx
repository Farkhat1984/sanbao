"use client";

import { FileText, ExternalLink, Pencil } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ARTIFACT_TYPE_LABELS } from "@/lib/constants";
import { CLARIFY_REGEX } from "@/lib/parse-message-content";
import type { ParsedPart } from "@/lib/parse-message-content";
import { markdownComponents, urlTransform } from "@/lib/markdown-components";

interface AssistantContentProps {
  /** Parsed parts (artifacts, edits, text) from parseContentWithArtifacts */
  parts: ParsedPart[];
  /** Whether any parts are artifacts or edits */
  hasSpecialParts: boolean;
  /** Raw display content (used when no special parts) */
  displayContent: string;
  /** Callback to open an artifact in the panel */
  onOpenArtifact: (part: ParsedPart) => void;
  /** Callback to open an edited artifact by title */
  onOpenEditedArtifact: (title: string) => void;
  /** Find artifact by title — returns version info for edit cards */
  findByTitle: (title: string) => { version: number } | undefined;
  /** Map of title → version number captured at the time edits were applied */
  appliedVersions: Map<string, number>;
}

/**
 * Renders the inner content of an assistant message bubble.
 * Handles text-only markdown, artifact cards, and edit cards.
 */
export function AssistantContent({
  parts,
  hasSpecialParts,
  displayContent,
  onOpenArtifact,
  onOpenEditedArtifact,
  findByTitle,
  appliedVersions,
}: AssistantContentProps) {
  return (
    <div className="prose-sanbao">
      {hasSpecialParts ? (
        parts.map((part, i) => {
          if (part.type === "text") {
            return part.content.trim() ? (
              <ReactMarkdown
                key={i}
                remarkPlugins={[remarkGfm]}
                urlTransform={urlTransform}
                components={markdownComponents}
              >
                {part.content}
              </ReactMarkdown>
            ) : null;
          }

          if (part.type === "artifact") {
            return (
              <div key={i}>
                {part.content.trim() && (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    urlTransform={urlTransform}
                    components={markdownComponents}
                  >
                    {part.content}
                  </ReactMarkdown>
                )}
                <button
                  onClick={() => onOpenArtifact(part)}
                  className="my-2 w-full flex items-center gap-3 p-3 rounded-xl bg-surface border border-border hover:border-accent hover:shadow-sm transition-all cursor-pointer text-left group/artifact"
                >
                  <div className="h-10 w-10 rounded-lg bg-accent-light flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {part.title}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {ARTIFACT_TYPE_LABELS[part.artifactType || ""] ||
                        part.artifactType}{" "}
                      &middot; Открыть в панели
                    </p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-text-secondary group-hover/artifact:text-accent transition-colors shrink-0" />
                </button>
              </div>
            );
          }

          if (part.type === "edit") {
            const appliedVer = appliedVersions.get(part.title || "");
            const displayVersion = appliedVer ?? findByTitle(part.title || "")?.version;
            return (
              <button
                key={i}
                onClick={() => onOpenEditedArtifact(part.title || "")}
                className="my-2 w-full flex items-center gap-3 p-3 rounded-xl bg-success-light border border-success/20 hover:border-success/40 hover:shadow-sm transition-all cursor-pointer text-left group/edit"
              >
                <div className="h-10 w-10 rounded-lg bg-success-light flex items-center justify-center shrink-0">
                  <Pencil className="h-5 w-5 text-success" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {part.title}
                  </p>
                  <p className="text-xs text-success">
                    {part.edits?.length} {part.edits?.length === 1 ? "изменение" : "изменений"}
                    {displayVersion != null ? ` · v${displayVersion}` : ""}
                    {" "}&middot; Нажмите чтобы открыть
                  </p>
                </div>
                <ExternalLink className="h-4 w-4 text-text-secondary group-hover/edit:text-success transition-colors shrink-0" />
              </button>
            );
          }

          return null;
        })
      ) : (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          urlTransform={urlTransform}
          components={markdownComponents}
        >
          {displayContent.replace(CLARIFY_REGEX, "").trim()}
        </ReactMarkdown>
      )}
    </div>
  );
}
