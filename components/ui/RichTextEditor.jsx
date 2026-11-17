"use client";

// Minimal rich-text editor (Tiptap): Bold · Italic · Underline · bulleted list ·
// numbered list · align left / center. Emits HTML via onChange ("" when empty).
// The server re-sanitises everything (lib/tasks/details.js sanitizeRichText), so
// this is never trusted.

import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { AlignCenter, AlignLeft, Bold, Italic, List, ListOrdered, Underline } from "lucide-react";

const btn =
  "flex size-8 items-center justify-center rounded-[8px] text-fg-muted transition-colors hover:bg-card-inset hover:text-fg focus-visible:outline-2 focus-visible:outline-brand-500 aria-pressed:bg-accent-soft aria-pressed:text-accent-fg";

export default function RichTextEditor({ id, value, onChange, labelledBy, describedBy, invalid }) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        strike: false,
        link: false,
      }),
      TextAlign.configure({ types: ["paragraph"], alignments: ["left", "center"] }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        id,
        role: "textbox",
        "aria-multiline": "true",
        ...(labelledBy ? { "aria-labelledby": labelledBy } : {}),
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
        ...(invalid ? { "aria-invalid": "true" } : {}),
        class: "rich-text min-h-32 px-3.5 py-3 text-sm text-fg outline-none",
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? "" : e.getHTML()),
  });

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            underline: e.isActive("underline"),
            bullet: e.isActive("bulletList"),
            ordered: e.isActive("orderedList"),
            center: e.isActive({ textAlign: "center" }),
          }
        : null,
  });

  const tools = [
    { key: "bold", label: "Bold", icon: Bold, run: (c) => c.toggleBold() },
    { key: "italic", label: "Italic", icon: Italic, run: (c) => c.toggleItalic() },
    { key: "underline", label: "Underline", icon: Underline, run: (c) => c.toggleUnderline() },
    { key: "bullet", label: "Bulleted list", icon: List, run: (c) => c.toggleBulletList() },
    { key: "ordered", label: "Numbered list", icon: ListOrdered, run: (c) => c.toggleOrderedList() },
    { key: "left", label: "Align left", icon: AlignLeft, run: (c) => c.setTextAlign("left"), on: (s) => !s.center },
    { key: "center", label: "Align center", icon: AlignCenter, run: (c) => c.setTextAlign("center") },
  ];

  return (
    <div
      className={`overflow-hidden rounded-[10px] border bg-card focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500 ${
        invalid ? "border-danger" : "border-line"
      }`}
    >
      <div role="toolbar" aria-label="Formatting" className="flex flex-wrap gap-0.5 border-b border-line-subtle bg-card-inset p-1">
        {tools.map((t) => {
          const pressed = state ? (t.on ? t.on(state) : !!state[t.key]) : false;
          return (
            <button
              key={t.key}
              type="button"
              aria-label={t.label}
              title={t.label}
              aria-pressed={pressed}
              disabled={!editor}
              onClick={() => editor && t.run(editor.chain().focus()).run()}
              className={btn}
            >
              <t.icon className="size-4" aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
