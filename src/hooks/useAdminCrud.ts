"use client";

import { useCallback } from "react";
import { api } from "@/lib/api-client";

interface UseAdminCrudOptions {
  /** API endpoint base path (e.g. "/api/admin/webhooks") */
  endpoint: string;
  /** Callback to refetch data after mutation */
  refetch: () => void;
}

interface UseAdminCrudReturn {
  /** Toggle isActive for item by id. Sends PUT with { isActive: !currentActive }. */
  handleToggle: (id: string, currentActive: boolean) => Promise<void>;
  /** Delete item by id with confirm dialog. Sends DELETE to endpoint/id. */
  handleDelete: (id: string, confirmMsg?: string) => Promise<void>;
}

/**
 * Shared hook for toggle/delete CRUD operations on admin list pages.
 * Eliminates duplicated handleToggle/handleDelete across webhooks, promo-codes,
 * api-keys, and other admin pages.
 */
export function useAdminCrud({
  endpoint,
  refetch,
}: UseAdminCrudOptions): UseAdminCrudReturn {
  const handleToggle = useCallback(
    async (id: string, currentActive: boolean) => {
      await api.put(`${endpoint}/${id}`, { isActive: !currentActive });
      refetch();
    },
    [endpoint, refetch]
  );

  const handleDelete = useCallback(
    async (id: string, confirmMsg = "Удалить?") => {
      if (!confirm(confirmMsg)) return;
      await api.delete(`${endpoint}/${id}`);
      refetch();
    },
    [endpoint, refetch]
  );

  return { handleToggle, handleDelete };
}
