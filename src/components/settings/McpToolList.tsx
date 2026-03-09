"use client";

import { Wrench } from "lucide-react";

interface McpToolInfo {
  name: string;
  description: string;
}

interface McpToolListProps {
  tools: McpToolInfo[];
}

/** Renders a list of MCP tools discovered on a server */
export function McpToolList({ tools }: McpToolListProps) {
  if (tools.length === 0) return null;

  return (
    <div className="border-t border-border px-3 py-2 space-y-1">
      {tools.map((tool) => (
        <div key={tool.name} className="flex items-start gap-2 py-1">
          <Wrench className="h-3 w-3 text-text-secondary mt-0.5 shrink-0" />
          <div>
            <span className="text-xs font-medium text-text-primary">{tool.name}</span>
            {tool.description && (
              <p className="text-[11px] text-text-secondary">{tool.description}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
