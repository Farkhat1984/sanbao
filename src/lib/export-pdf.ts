import { sanitizeFilename } from "./export-utils";

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
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    pagebreak: { mode: ["avoid-all", "css", "legacy"] },
  };

  await html2pdf().set(opts).from(element).save();
}
