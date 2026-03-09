"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api-client";

interface UseAdminListOptions {
  /** API endpoint path (e.g. "/api/admin/webhooks") */
  endpoint: string;
  /** Items per page (default: 20) */
  perPage?: number;
  /** Key to extract items array from response (e.g. "webhooks", "sessions") */
  dataKey: string;
  /** Key to extract total count from response (default: "total") */
  totalKey?: string;
}

interface UseAdminListReturn<T> {
  items: T[];
  loading: boolean;
  page: number;
  total: number;
  totalPages: number;
  setPage: (p: number) => void;
  refetch: () => void;
}

/**
 * Shared hook for admin list pages with pagination.
 * Replaces the duplicated fetch-list-state boilerplate across 15+ admin pages.
 */
export function useAdminList<T>({
  endpoint,
  perPage = 20,
  dataKey,
  totalKey = "total",
}: UseAdminListOptions): UseAdminListReturn<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(perPage),
      });
      const data = await api.get<Record<string, unknown>>(`${endpoint}?${params}`);
      setItems((data[dataKey] as T[]) || []);
      setTotal((data[totalKey] as number) || 0);
    } finally {
      setLoading(false);
    }
  }, [endpoint, page, perPage, dataKey, totalKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPages = Math.ceil(total / perPage);

  return {
    items,
    loading,
    page,
    total,
    totalPages,
    setPage,
    refetch: fetchData,
  };
}
