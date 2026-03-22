"use client";

import { memo } from "react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useTranslation } from "@/hooks/useTranslation";

interface DeleteConfirmationProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteConfirmation = memo(function DeleteConfirmation({
  isOpen,
  onConfirm,
  onCancel,
}: DeleteConfirmationProps) {
  const { t } = useTranslation();

  return (
    <ConfirmModal
      isOpen={isOpen}
      onConfirm={onConfirm}
      onCancel={onCancel}
      title={t("sidebar.deleteChatConfirm")}
      description={t("sidebar.deleteChatDescription")}
      confirmText={t("common.delete")}
    />
  );
});
