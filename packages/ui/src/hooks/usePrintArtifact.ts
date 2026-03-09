import { useCallback, type RefObject } from "react";

interface UsePrintArtifactOptions {
  previewRef: RefObject<HTMLDivElement | null>;
  activeTab: string;
  setTab: (tab: "preview" | "edit" | "source") => void;
}

/**
 * Handles printing artifact content by cloning .prose-legal into a
 * top-level print container to avoid overflow clipping from parent panels.
 */
export function usePrintArtifact({ previewRef, activeTab, setTab }: UsePrintArtifactOptions) {
  const handlePrint = useCallback(async () => {
    // Ensure preview tab is active so previewRef has content
    if (activeTab !== "preview") {
      setTab("preview");
      await new Promise<void>((resolve) => {
        const check = () => {
          if (previewRef.current?.querySelector(".prose-legal")) resolve();
          else requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
        setTimeout(resolve, 1000);
      });
    }

    const proseLegal = previewRef.current?.querySelector(".prose-legal");
    if (!proseLegal) {
      window.print();
      return;
    }

    // Clone prose-legal content to a direct child of <body> to avoid overflow clipping
    const container = document.createElement("div");
    container.id = "print-container";
    container.className = "prose-legal";
    container.innerHTML = proseLegal.innerHTML;
    document.body.appendChild(container);

    const cleanup = () => {
      if (container.parentNode) container.remove();
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
  }, [activeTab, setTab, previewRef]);

  return { handlePrint };
}
