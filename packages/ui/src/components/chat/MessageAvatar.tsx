"use client";

import { User } from "lucide-react";
import { SanbaoCompass } from "@/components/ui/SanbaoCompass";
import { cn } from "@/lib/utils";
import { ICON_MAP } from "@/components/agents/AgentIconPicker";

interface MessageAvatarProps {
  isUser: boolean;
  agentIcon?: string;
  agentIconColor?: string;
}

/** Renders the circular avatar for user or assistant messages. */
export function MessageAvatar({ isUser, agentIcon, agentIconColor }: MessageAvatarProps) {
  const hasCustomIcon = agentIcon && ICON_MAP[agentIcon];
  const AgentIcon = hasCustomIcon ? ICON_MAP[agentIcon] : null;

  return (
    <div
      className={cn(
        "h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5",
        isUser
          ? "bg-accent text-white"
          : !agentIconColor && "bg-accent text-white"
      )}
      style={!isUser && agentIconColor ? { backgroundColor: agentIconColor, color: "white" } : undefined}
    >
      {isUser ? (
        <User className="h-4 w-4" />
      ) : AgentIcon ? (
        <AgentIcon className="h-4 w-4" />
      ) : (
        <SanbaoCompass size={18} className="text-white" />
      )}
    </div>
  );
}
