"use client";

import { memo } from "react";
import { createPortal } from "react-dom";
import { Pin, Trash2, Archive, ArchiveRestore } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "@/hooks/useTranslation";

interface ConversationContextMenuProps {
  showMenu: boolean;
  menuPos: { top: number; left: number } | null;
  menuRef: React.RefObject<HTMLDivElement | null>;
  isArchived?: boolean;
  pinned: boolean;
  onPinToggle: (e: React.MouseEvent) => void;
  onArchive: (e: React.MouseEvent) => void;
  onUnarchive: (e: React.MouseEvent) => void;
  onDeleteClick: (e: React.MouseEvent) => void;
}

export const ConversationContextMenu = memo(function ConversationContextMenu({
  showMenu,
  menuPos,
  menuRef,
  isArchived,
  pinned,
  onPinToggle,
  onArchive,
  onUnarchive,
  onDeleteClick,
}: ConversationContextMenuProps) {
  const { t } = useTranslation();

  if (!showMenu || !menuPos) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.12 }}
        style={{ top: menuPos.top, left: menuPos.left }}
        className="fixed z-[100] w-40 bg-surface border border-border rounded-xl shadow-lg py-1"
      >
        {!isArchived && (
          <button onClick={onPinToggle} aria-label={t("sidebar.pin")} className="w-full px-3 py-1.5 text-xs text-left text-text-secondary hover:bg-surface-alt flex items-center gap-2 cursor-pointer">
            <Pin className="h-3 w-3" />
            {pinned ? t("sidebar.unpin") : t("sidebar.pin")}
          </button>
        )}
        {isArchived ? (
          <button onClick={onUnarchive} aria-label={t("sidebar.unarchive")} className="w-full px-3 py-1.5 text-xs text-left text-text-secondary hover:bg-surface-alt flex items-center gap-2 cursor-pointer">
            <ArchiveRestore className="h-3 w-3" />
            {t("sidebar.unarchive")}
          </button>
        ) : (
          <button onClick={onArchive} aria-label={t("sidebar.archive")} className="w-full px-3 py-1.5 text-xs text-left text-text-secondary hover:bg-surface-alt flex items-center gap-2 cursor-pointer">
            <Archive className="h-3 w-3" />
            {t("sidebar.archive")}
          </button>
        )}
        <button
          onClick={onDeleteClick}
          aria-label={t("sidebar.deleteChat")}
          className="w-full px-3 py-1.5 text-xs text-left text-error hover:bg-error-light flex items-center gap-2 cursor-pointer"
        >
          <Trash2 className="h-3 w-3" />
          {t("common.delete")}
        </button>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
});
