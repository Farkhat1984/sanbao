import { sanitizeFilename } from "./export-utils";

/**
 * Color-related CSS properties that html2canvas needs to parse.
 * Tailwind CSS v4 uses oklab()/oklch() which html2canvas doesn't support,
 * so we resolve them to rgb() via getComputedStyle() before rendering.
 */
const COLOR_STYLE_PROPS = [
  "color",
  "backgroundColor",
  "borderColor",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
  "outlineColor",
  "textDecorationColor",
  "caretColor",
  "columnRuleColor",
  "boxShadow",
] as const;

function resolveColorsToRgb(
  sourceRoot: HTMLElement,
  clonedRoot: HTMLElement
): void {
  const originals = Array.from(sourceRoot.querySelectorAll("*"));
  const clones = Array.from(clonedRoot.querySelectorAll("*"));
  originals.unshift(sourceRoot);
  clones.unshift(clonedRoot);
  const len = Math.min(originals.length, clones.length);

  for (let i = 0; i < len; i++) {
    const computed = getComputedStyle(originals[i]);
    const clone = clones[i] as HTMLElement;
    for (const prop of COLOR_STYLE_PROPS) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const val = (computed as any)[prop] as string | undefined;
      if (val) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (clone.style as any)[prop] = val;
      }
    }
  }
}

export async function exportToPdf(
  element: HTMLElement,
  title: string
): Promise<void> {
  const html2pdf = (await import("html2pdf.js")).default;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const opts: any = {
    margin: [15, 15, 15, 15],
    filename: `${sanitizeFilename(title)}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      onclone: (_doc: Document, clonedEl: HTMLElement) => {
        // Browser resolves oklab()/oklch() → rgb() in getComputedStyle.
        // Apply resolved values as inline styles so html2canvas can parse them.
        resolveColorsToRgb(element, clonedEl);
      },
    },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    pagebreak: { mode: ["avoid-all", "css", "legacy"] },
  };

  await html2pdf().set(opts).from(element).save();
}
