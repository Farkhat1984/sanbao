import { useEffect, useState } from "react";

interface LinkEntry {
  label: string;
  icon: string;
  handler: string;
  param_key: string;
  domain: string;
}

type LinkRegistry = Record<string, LinkEntry>;

let cached: LinkRegistry | null = null;
let fetchPromise: Promise<LinkRegistry> | null = null;

async function fetchRegistry(): Promise<LinkRegistry> {
  try {
    const res = await fetch("/api/link-registry");
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

export function useLinkRegistry() {
  const [registry, setRegistry] = useState<LinkRegistry>(cached || {});

  useEffect(() => {
    if (cached) {
      setRegistry(cached);
      return;
    }
    if (!fetchPromise) {
      fetchPromise = fetchRegistry().then((data) => {
        cached = data;
        return data;
      });
    }
    fetchPromise.then(setRegistry);
  }, []);

  return {
    registry,
    getLabel: (code: string) => registry[code]?.label || code,
    getIcon: (code: string) => registry[code]?.icon || "legal",
  };
}
