import { sanitizeFilename } from "./export-utils";

/**
 * PDF export using html2canvas-pro (supports oklab/oklch natively) + jsPDF.
 * html2canvas-pro is a drop-in replacement that handles modern CSS color
 * functions (oklch, oklab, color-mix) which Tailwind CSS v4 generates.
 */

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MARGIN_MM = 15;
const CONTENT_WIDTH_MM = A4_WIDTH_MM - MARGIN_MM * 2;
const CONTENT_HEIGHT_MM = A4_HEIGHT_MM - MARGIN_MM * 2;

export async function exportToPdf(
  element: HTMLElement,
  title: string
): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    scrollY: 0,
    windowHeight: element.scrollHeight,
    height: element.scrollHeight,
    onclone: (_doc: Document, clonedEl: HTMLElement) => {
      // Remove overflow clipping so full content is captured
      let node: HTMLElement | null = clonedEl;
      while (node) {
        const ov = node.style.overflow || getComputedStyle(node).overflow;
        if (ov === "auto" || ov === "hidden" || ov === "scroll") {
          node.style.overflow = "visible";
          node.style.height = "auto";
          node.style.maxHeight = "none";
        }
        node = node.parentElement;
      }
      clonedEl.style.overflow = "visible";
      clonedEl.style.height = "auto";
      clonedEl.style.maxHeight = "none";
    },
  });

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  const imgWidth = CONTENT_WIDTH_MM;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  // Split canvas into A4 pages
  const pageCount = Math.ceil(imgHeight / CONTENT_HEIGHT_MM);

  for (let i = 0; i < pageCount; i++) {
    if (i > 0) pdf.addPage();

    // Slice the canvas for this page
    const srcY = i * (canvas.width * CONTENT_HEIGHT_MM) / CONTENT_WIDTH_MM;
    const srcH = (canvas.width * CONTENT_HEIGHT_MM) / CONTENT_WIDTH_MM;

    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = Math.min(srcH, canvas.height - srcY);

    const ctx = pageCanvas.getContext("2d");
    if (!ctx) continue;
    ctx.drawImage(
      canvas,
      0, srcY,
      canvas.width, pageCanvas.height,
      0, 0,
      pageCanvas.width, pageCanvas.height,
    );

    const pageData = pageCanvas.toDataURL("image/jpeg", 0.95);
    const pageImgHeight = (pageCanvas.height * imgWidth) / pageCanvas.width;
    pdf.addImage(pageData, "JPEG", MARGIN_MM, MARGIN_MM, imgWidth, pageImgHeight);
  }

  pdf.save(`${sanitizeFilename(title)}.pdf`);
}
