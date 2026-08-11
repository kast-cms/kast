'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
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

/** Field chrome, matched to Input/Textarea so the editor reads as one of them. */
const FRAME_CLASSES = [
  'overflow-hidden rounded-md border border-input bg-card shadow-2xs',
  'transition-[border-color,box-shadow] duration-150 ease-out-quad',
  'focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25',
];

/**
 * Typography for the editable document. The project does not ship the
 * typography plugin, so block styles are declared here against design tokens
 * rather than relying on `prose`.
 */
const CONTENT_CLASSES = [
  '[&_.ProseMirror]:min-h-32 [&_.ProseMirror]:px-3 [&_.ProseMirror]:py-2.5',
  '[&_.ProseMirror]:text-sm [&_.ProseMirror]:text-foreground [&_.ProseMirror]:outline-none',
  '[&_.ProseMirror>*+*]:mt-3',
  '[&_.ProseMirror_h1]:text-xl [&_.ProseMirror_h1]:font-semibold',
  '[&_.ProseMirror_h2]:text-lg [&_.ProseMirror_h2]:font-semibold',
  '[&_.ProseMirror_h3]:text-md [&_.ProseMirror_h3]:font-semibold',
  '[&_.ProseMirror_a]:text-primary [&_.ProseMirror_a]:underline [&_.ProseMirror_a]:underline-offset-2',
  '[&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:ps-5',
  '[&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:ps-5',
  '[&_.ProseMirror_li]:my-1',
  '[&_.ProseMirror_blockquote]:border-s-2 [&_.ProseMirror_blockquote]:border-border-strong',
  '[&_.ProseMirror_blockquote]:ps-3 [&_.ProseMirror_blockquote]:text-muted-foreground',
  '[&_.ProseMirror_code]:rounded-sm [&_.ProseMirror_code]:bg-muted [&_.ProseMirror_code]:px-1 [&_.ProseMirror_code]:py-0.5 [&_.ProseMirror_code]:text-xs',
  '[&_.ProseMirror_pre]:overflow-x-auto [&_.ProseMirror_pre]:rounded-md [&_.ProseMirror_pre]:bg-muted [&_.ProseMirror_pre]:p-3 [&_.ProseMirror_pre]:text-xs',
  '[&_.ProseMirror_hr]:border-border',
];

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
      <div className={cn(FRAME_CLASSES)}>
        <div className="flex gap-1 border-b border-border bg-muted/40 px-1.5 py-1">
          {Array.from({ length: 9 }, (_, i) => (
            <Skeleton key={i} className="size-7 rounded-sm" />
          ))}
        </div>
        <div className="space-y-2 px-3 py-2.5">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-11/12" />
          <Skeleton className="h-3.5 w-2/5" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn(FRAME_CLASSES, disabled === true && 'opacity-60')}>
      <RichTextToolbar editor={editor} />
      <EditorContent editor={editor} className={cn(CONTENT_CLASSES)} />
    </div>
  );
}
