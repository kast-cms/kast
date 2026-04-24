'use client';

import { Button } from '@/components/ui/button';
import type { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Underline,
  Undo2,
} from 'lucide-react';
import type { JSX } from 'react';

interface RichTextToolbarProps {
  editor: Editor;
}

export function RichTextToolbar({ editor }: RichTextToolbarProps): JSX.Element {
  function toggleLink(): void {
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const href = window.prompt('URL');
    if (href) {
      editor.chain().focus().setLink({ href }).run();
    }
  }

  return (
    <div className="flex flex-wrap gap-0.5 border-b border-[--color-border] p-1">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-7"
        aria-label="Bold"
        data-active={editor.isActive('bold') ? 'true' : undefined}
        onClick={() => {
          editor.chain().focus().toggleBold().run();
        }}
      >
        <Bold className="size-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-7"
        aria-label="Italic"
        onClick={() => {
          editor.chain().focus().toggleItalic().run();
        }}
      >
        <Italic className="size-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-7"
        aria-label="Underline"
        onClick={() => {
          editor.chain().focus().toggleUnderline().run();
        }}
      >
        <Underline className="size-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-7"
        aria-label="Link"
        onClick={toggleLink}
      >
        <Link2 className="size-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-7"
        aria-label="Bullet list"
        onClick={() => {
          editor.chain().focus().toggleBulletList().run();
        }}
      >
        <List className="size-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-7"
        aria-label="Ordered list"
        onClick={() => {
          editor.chain().focus().toggleOrderedList().run();
        }}
      >
        <ListOrdered className="size-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-7"
        aria-label="Blockquote"
        onClick={() => {
          editor.chain().focus().toggleBlockquote().run();
        }}
      >
        <Quote className="size-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-7"
        aria-label="Undo"
        onClick={() => {
          editor.chain().focus().undo().run();
        }}
      >
        <Undo2 className="size-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-7"
        aria-label="Redo"
        onClick={() => {
          editor.chain().focus().redo().run();
        }}
      >
        <Redo2 className="size-4" />
      </Button>
    </div>
  );
}
