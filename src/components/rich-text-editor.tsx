"use client";

import { Bold, Italic, List, ListOrdered, Redo, Undo } from "lucide-react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

function ToolbarButton({
  active,
  disabled,
  onClick,
  children,
  label,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      // mousedown (not click) so the editor's selection never loses focus —
      // a plain onClick fires after mousedown already blurred the editor,
      // which drops the cursor position and swallows text typed right after.
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-foreground-light hover:bg-surface-200 disabled:opacity-40 ${
        active ? "bg-brand-50 text-brand-700" : ""
      }`}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: placeholder || "" }),
    ],
    content: value || "",
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    editorProps: {
      attributes: {
        class:
          "min-h-[140px] rounded-b-xl bg-surface px-3.5 py-2.5 text-sm text-foreground focus:outline-none prose prose-sm max-w-none [&_p.is-editor-empty:first-child::before]:pointer-events-none [&_p.is-editor-empty:first-child::before]:float-left [&_p.is-editor-empty:first-child::before]:h-0 [&_p.is-editor-empty:first-child::before]:text-foreground-lighter [&_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
      },
    },
  });

  return (
    <div className="overflow-hidden rounded-xl border border-border focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-400/20">
      <div className="flex items-center gap-1 border-b border-border bg-surface-200 px-2 py-1.5">
        <ToolbarButton
          label="Bold"
          active={editor?.isActive("bold")}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={editor?.isActive("italic")}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Bullet list"
          active={editor?.isActive("bulletList")}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          active={editor?.isActive("orderedList")}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton
          label="Undo"
          disabled={!editor}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          <Undo className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Redo"
          disabled={!editor}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          <Redo className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>
      {!editor ? (
        <div className="min-h-[140px] rounded-b-xl bg-surface px-3.5 py-2.5 text-sm text-foreground-lighter">
          Loading editor…
        </div>
      ) : (
        <EditorContent editor={editor} />
      )}
    </div>
  );
}
