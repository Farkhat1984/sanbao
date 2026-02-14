"use client";

import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Highlighter,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Table as TableIcon,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Editor } from "@tiptap/react";

interface EditorToolbarProps {
  editor: Editor | null;
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  if (!editor) return null;

  const btnClass = (active: boolean) =>
    cn(
      "h-7 w-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer",
      active && "text-accent bg-accent-light"
    );

  const divider = (
    <div className="w-px h-5 bg-border mx-1 shrink-0" />
  );

  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-border flex-wrap shrink-0">
      {/* Text formatting */}
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btnClass(editor.isActive("bold"))}
        title="Жирный (Ctrl+B)"
      >
        <Bold className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={btnClass(editor.isActive("italic"))}
        title="Курсив (Ctrl+I)"
      >
        <Italic className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={btnClass(editor.isActive("underline"))}
        title="Подчёркнутый (Ctrl+U)"
      >
        <UnderlineIcon className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        className={btnClass(editor.isActive("highlight"))}
        title="Выделение"
      >
        <Highlighter className="h-3.5 w-3.5" />
      </button>

      {divider}

      {/* Headings */}
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={btnClass(editor.isActive("heading", { level: 1 }))}
        title="Заголовок 1"
      >
        <Heading1 className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={btnClass(editor.isActive("heading", { level: 2 }))}
        title="Заголовок 2"
      >
        <Heading2 className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={btnClass(editor.isActive("heading", { level: 3 }))}
        title="Заголовок 3"
      >
        <Heading3 className="h-3.5 w-3.5" />
      </button>

      {divider}

      {/* Lists */}
      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={btnClass(editor.isActive("bulletList"))}
        title="Маркированный список"
      >
        <List className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={btnClass(editor.isActive("orderedList"))}
        title="Нумерованный список"
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </button>

      {divider}

      {/* Alignment */}
      <button
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        className={btnClass(editor.isActive({ textAlign: "left" }))}
        title="По левому краю"
      >
        <AlignLeft className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        className={btnClass(editor.isActive({ textAlign: "center" }))}
        title="По центру"
      >
        <AlignCenter className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        className={btnClass(editor.isActive({ textAlign: "right" }))}
        title="По правому краю"
      >
        <AlignRight className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        className={btnClass(editor.isActive({ textAlign: "justify" }))}
        title="По ширине"
      >
        <AlignJustify className="h-3.5 w-3.5" />
      </button>

      {divider}

      {/* Insert */}
      <button
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run()
        }
        className={btnClass(false)}
        title="Вставить таблицу"
      >
        <TableIcon className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        className={btnClass(false)}
        title="Горизонтальная линия"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
