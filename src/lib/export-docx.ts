import type { ArtifactType } from "@/types/chat";
import { sanitizeFilename } from "./export-utils";

const TYPE_TITLES: Record<string, string> = {
  CONTRACT: "ДОГОВОР",
  CLAIM: "ИСКОВОЕ ЗАЯВЛЕНИЕ",
  COMPLAINT: "ЖАЛОБА",
  DOCUMENT: "ДОКУМЕНТ",
  CODE: "КОД",
  ANALYSIS: "ПРАВОВОЙ АНАЛИЗ",
};

// ─── Inline formatting parser ───────────────────────────

interface TextSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

function parseInlineFormatting(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  // Match **bold**, *italic*, __underline__, ___bold+underline___
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|__(.+?)__|_(.+?)_|([^*_]+))/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match[2]) {
      segments.push({ text: match[2], bold: true, italic: true });
    } else if (match[3]) {
      segments.push({ text: match[3], bold: true });
    } else if (match[4]) {
      segments.push({ text: match[4], italic: true });
    } else if (match[5]) {
      segments.push({ text: match[5], underline: true });
    } else if (match[6]) {
      segments.push({ text: match[6], italic: true });
    } else if (match[7]) {
      segments.push({ text: match[7] });
    }
  }

  if (segments.length === 0) {
    segments.push({ text });
  }

  return segments;
}

// ─── Table parser ────────────────────────────────────────

interface TableData {
  headers: string[];
  rows: string[][];
}

function parseMarkdownTable(lines: string[]): TableData | null {
  if (lines.length < 2) return null;

  const parseRow = (line: string): string[] =>
    line
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0 && !/^[-:]+$/.test(c));

  const headers = parseRow(lines[0]);
  if (headers.length === 0) return null;

  // Skip separator line (line with ---)
  const startIdx = lines[1].includes("---") ? 2 : 1;
  const rows: string[][] = [];

  for (let i = startIdx; i < lines.length; i++) {
    const row = parseRow(lines[i]);
    if (row.length > 0) rows.push(row);
  }

  return { headers, rows };
}

// ─── Main export function ────────────────────────────────

export async function markdownToDocx(
  content: string,
  title: string,
  type: ArtifactType
): Promise<Blob> {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    HeadingLevel,
    AlignmentType,
    WidthType,
    BorderStyle,
    convertMillimetersToTwip,
  } = await import("docx");

  const children: (
    | InstanceType<typeof Paragraph>
    | InstanceType<typeof Table>
  )[] = [];

  const lines = content.split("\n");
  let i = 0;

  // Helper: create TextRun from segments
  const createTextRuns = (text: string, extraBold = false) =>
    parseInlineFormatting(text).map(
      (seg) =>
        new TextRun({
          text: seg.text,
          bold: seg.bold || extraBold,
          italics: seg.italic,
          underline: seg.underline ? {} : undefined,
          font: "Times New Roman",
          size: 24, // 12pt
        })
    );

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) {
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      children.push(
        new Paragraph({
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
          },
          spacing: { before: 200, after: 200 },
        })
      );
      i++;
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      const headingLevel =
        level === 1
          ? HeadingLevel.HEADING_1
          : level === 2
            ? HeadingLevel.HEADING_2
            : HeadingLevel.HEADING_3;

      children.push(
        new Paragraph({
          heading: headingLevel,
          alignment:
            level === 1 ? AlignmentType.CENTER : AlignmentType.LEFT,
          spacing: { before: level === 1 ? 400 : 300, after: 200 },
          children: [
            new TextRun({
              text: headingText,
              bold: true,
              font: "Times New Roman",
              size: level === 1 ? 32 : level === 2 ? 28 : 26,
              allCaps: level === 1,
            }),
          ],
        })
      );
      i++;
      continue;
    }

    // Table detection: lines starting with |
    if (trimmed.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i].trim());
        i++;
      }

      const tableData = parseMarkdownTable(tableLines);
      if (tableData && tableData.headers.length > 0) {
        const colCount = tableData.headers.length;
        // A4 text area: 210mm - 30mm left - 15mm right = 165mm ≈ 9356 twips
        const tableWidthTwips = convertMillimetersToTwip(165);
        const colWidth = Math.floor(tableWidthTwips / colCount);

        const headerRow = new TableRow({
          tableHeader: true,
          children: tableData.headers.map(
            (h) =>
              new TableCell({
                width: { size: colWidth, type: WidthType.DXA },
                shading: { fill: "E8EBF0" },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: h,
                        bold: true,
                        font: "Times New Roman",
                        size: 22,
                      }),
                    ],
                  }),
                ],
              })
          ),
        });

        const dataRows = tableData.rows.map(
          (row) =>
            new TableRow({
              children: row
                .concat(
                  Array(Math.max(0, colCount - row.length)).fill("")
                )
                .slice(0, colCount)
                .map(
                  (cell) =>
                    new TableCell({
                      width: { size: colWidth, type: WidthType.DXA },
                      children: [
                        new Paragraph({
                          children: createTextRuns(cell),
                        }),
                      ],
                    })
                ),
            })
        );

        children.push(
          new Table({
            rows: [headerRow, ...dataRows],
            width: { size: 100, type: WidthType.PERCENTAGE },
          })
        );
        children.push(new Paragraph({ spacing: { after: 100 } }));
      }
      continue;
    }

    // Numbered list
    const numberedMatch = trimmed.match(/^(\d+)[.)]\s+(.+)$/);
    if (numberedMatch) {
      children.push(
        new Paragraph({
          numbering: { reference: "legal-numbering", level: 0 },
          spacing: { before: 60, after: 60 },
          indent: { left: convertMillimetersToTwip(10) },
          children: createTextRuns(numberedMatch[2]),
        })
      );
      i++;
      continue;
    }

    // Bullet list
    const bulletMatch = trimmed.match(/^[-*+]\s+(.+)$/);
    if (bulletMatch) {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { before: 60, after: 60 },
          children: createTextRuns(bulletMatch[1]),
        })
      );
      i++;
      continue;
    }

    // Checkbox list items (- [ ] or - [x])
    const checkboxMatch = trimmed.match(/^[-*]\s+\[([ xX])\]\s+(.+)$/);
    if (checkboxMatch) {
      const checked = checkboxMatch[1].toLowerCase() === "x";
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { before: 60, after: 60 },
          children: [
            new TextRun({
              text: checked ? "\u2611 " : "\u2610 ",
              font: "Segoe UI Symbol",
              size: 24,
            }),
            ...createTextRuns(checkboxMatch[2]),
          ],
        })
      );
      i++;
      continue;
    }

    // Regular paragraph
    children.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { before: 60, after: 60, line: 360 },
        indent: { firstLine: convertMillimetersToTwip(12.5) },
        wordWrap: true,
        children: createTextRuns(trimmed),
      })
    );
    i++;
  }

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "legal-numbering",
          levels: [
            {
              level: 0,
              format: "decimal" as const,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: {
                    left: convertMillimetersToTwip(10),
                    hanging: convertMillimetersToTwip(5),
                  },
                },
                run: { font: "Times New Roman", size: 24 },
              },
            },
          ],
        },
      ],
    },
    styles: {
      default: {
        document: {
          run: { font: "Times New Roman", size: 24 },
        },
        heading1: {
          run: {
            font: "Times New Roman",
            size: 32,
            bold: true,
            allCaps: true,
          },
          paragraph: {
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 200 },
          },
        },
        heading2: {
          run: { font: "Times New Roman", size: 28, bold: true },
          paragraph: {
            spacing: { before: 300, after: 200 },
          },
        },
        heading3: {
          run: { font: "Times New Roman", size: 26, bold: true },
          paragraph: {
            spacing: { before: 200, after: 100 },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertMillimetersToTwip(210),
              height: convertMillimetersToTwip(297),
            },
            margin: {
              top: convertMillimetersToTwip(20),
              bottom: convertMillimetersToTwip(20),
              left: convertMillimetersToTwip(30),
              right: convertMillimetersToTwip(15),
            },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  return blob;
}
