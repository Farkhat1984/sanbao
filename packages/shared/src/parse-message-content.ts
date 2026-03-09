// ─── Message content parsing ─────────────────────────────
// Extracts sanbao-doc, sanbao-edit, and sanbao-clarify tags
// from assistant message content.

const CLARIFY_REGEX = /<sanbao-clarify>[\s\S]*?<\/sanbao-clarify>/g;

const ARTIFACT_REGEX =
  /<sanbao-doc\s+type="(\w+)"\s+title="([^"]*)">([\s\S]*?)<\/sanbao-doc>/g;

const EDIT_REGEX =
  /<sanbao-edit\s+target="([^"]*)">([\s\S]*?)<\/sanbao-edit>/g;

const REPLACE_REGEX =
  /<replace>\s*<old>([\s\S]*?)<\/old>\s*<new>([\s\S]*?)<\/new>\s*<\/replace>/g;

export { CLARIFY_REGEX };

export interface ParsedPart {
  type: "text" | "artifact" | "edit";
  content: string;
  artifactType?: string;
  title?: string;
  edits?: Array<{ old: string; new: string }>;
}

export function parseContentWithArtifacts(rawContent: string): ParsedPart[] {
  const content = rawContent.replace(CLARIFY_REGEX, "").trim();
  const parts: ParsedPart[] = [];
  let lastIndex = 0;

  // Combine both regexes — find all matches sorted by position
  const allMatches: Array<{
    index: number;
    end: number;
    part: ParsedPart;
  }> = [];

  // Find artifacts
  ARTIFACT_REGEX.lastIndex = 0;
  let match;
  while ((match = ARTIFACT_REGEX.exec(content)) !== null) {
    allMatches.push({
      index: match.index,
      end: ARTIFACT_REGEX.lastIndex,
      part: {
        type: "artifact",
        artifactType: match[1],
        title: match[2],
        content: match[3].trim(),
      },
    });
  }

  // Find edits
  EDIT_REGEX.lastIndex = 0;
  while ((match = EDIT_REGEX.exec(content)) !== null) {
    const target = match[1];
    const editBody = match[2];
    const edits: Array<{ old: string; new: string }> = [];

    REPLACE_REGEX.lastIndex = 0;
    let replaceMatch;
    while ((replaceMatch = REPLACE_REGEX.exec(editBody)) !== null) {
      edits.push({ old: replaceMatch[1].trim(), new: replaceMatch[2].trim() });
    }

    if (edits.length > 0) {
      allMatches.push({
        index: match.index,
        end: EDIT_REGEX.lastIndex,
        part: {
          type: "edit",
          title: target,
          content: "",
          edits,
        },
      });
    }
  }

  // Sort by position
  allMatches.sort((a, b) => a.index - b.index);

  for (const m of allMatches) {
    if (m.index > lastIndex) {
      parts.push({ type: "text", content: content.slice(lastIndex, m.index) });
    }
    parts.push(m.part);
    lastIndex = m.end;
  }

  if (lastIndex < content.length) {
    parts.push({ type: "text", content: content.slice(lastIndex) });
  }

  return parts;
}
