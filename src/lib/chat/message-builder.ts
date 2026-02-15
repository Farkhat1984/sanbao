// ─── Message building utilities for chat API ─────────────
// Extracted from route.ts — builds API-ready messages from DB messages,
// handles attachments, file content prepending, and multimodal format.

// ─── Attachment types ────────────────────────────────────

export interface ChatAttachment {
  name: string;
  type: string;
  base64?: string;
  textContent?: string;
}

// ─── Process messages with attachments ───────────────────

export function buildApiMessages(
  messages: Array<{ role: string; content: string }>,
  attachments: ChatAttachment[],
  systemPrompt: string
) {
  const apiMessages: Array<Record<string, unknown>> = [
    { role: "system", content: systemPrompt },
  ];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    // Skip assistant messages with empty content (streaming placeholders)
    if (msg.role === "assistant" && !msg.content.trim()) continue;

    // Only attach files to the last user message
    if (i === messages.length - 1 && msg.role === "user" && attachments.length > 0) {
      const imageAttachments = attachments.filter((a) => a.type?.startsWith("image/"));
      const textAttachments = attachments.filter((a) => !a.type?.startsWith("image/"));

      let textContent = msg.content;

      // Prepend text file contents
      if (textAttachments.length > 0) {
        const textParts = textAttachments
          .map((a) => `--- Файл: ${a.name} ---\n${a.textContent}`)
          .join("\n\n");
        textContent = `${textParts}\n\n${textContent}`;
      }

      // If there are images, use multimodal format
      if (imageAttachments.length > 0) {
        const content: Array<Record<string, unknown>> = [];
        for (const img of imageAttachments) {
          content.push({
            type: "image_url",
            image_url: { url: `data:${img.type};base64,${img.base64}` },
          });
        }
        content.push({ type: "text", text: textContent });
        apiMessages.push({ role: msg.role, content });
      } else {
        apiMessages.push({ role: msg.role, content: textContent });
      }
    } else {
      apiMessages.push(msg);
    }
  }

  return apiMessages;
}
