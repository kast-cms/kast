'use client';

import LinkExt from '@tiptap/extension-link';
import UnderlineExt from '@tiptap/extension-underline';
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, type JSX } from 'react';
import { RichTextToolbar } from './rich-text-toolbar';

interface RichTextEditorProps {
  value: JSONContent | null;
  onChange: (val: JSONContent) => void;
  disabled?: boolean;
}

export function RichTextEditor({ value, onChange, disabled }: RichTextEditorProps): JSX.Element {
  const editor = useEditor({
    // Next renders this on the server first; Tiptap throws outright unless it is
    // told not to build the editor during that pass.
    immediatelyRender: false,
    extensions: [StarterKit, UnderlineExt, LinkExt.configure({ openOnClick: false })],
    ...(value !== null ? { content: value } : {}),
    editable: !disabled,
    onUpdate({ editor: e }) {
      onChange(e.getJSON());
    },
  });

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  // Null until the editor is built on the client — see immediatelyRender above.
  if (!editor) {
    return (
      <div className="h-32 rounded-md border border-[--color-border] bg-[--color-background]" />
    );
  }

  return (
    <div className="rounded-md border border-[--color-border] bg-[--color-background]">
      <RichTextToolbar editor={editor} />
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none p-3 focus-within:outline-none"
      />
    </div>
  );
}
