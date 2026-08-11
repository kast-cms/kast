'use client';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Hint } from '@/components/ui/tooltip';
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
import type { JSX, ReactNode } from 'react';

interface RichTextToolbarProps {
  editor: Editor;
}

interface ToolbarButtonProps {
  label: string;
  /** Omit for one-shot commands (undo/redo) — only toggles report pressed state. */
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}

function ToolbarButton({ label, active, onClick, children }: ToolbarButtonProps): JSX.Element {
  return (
    <Hint label={label}>
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        aria-label={label}
        aria-pressed={active}
        data-active={active === true ? 'true' : undefined}
        className="text-muted-foreground hover:text-foreground data-[active=true]:bg-primary-subtle data-[active=true]:text-primary-subtle-foreground"
        onClick={onClick}
      >
        {children}
      </Button>
    </Hint>
  );
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
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 px-1.5 py-1">
      <ToolbarButton
        label="Bold"
        active={editor.isActive('bold')}
        onClick={() => {
          editor.chain().focus().toggleBold().run();
        }}
      >
        <Bold />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={editor.isActive('italic')}
        onClick={() => {
          editor.chain().focus().toggleItalic().run();
        }}
      >
        <Italic />
      </ToolbarButton>
      <ToolbarButton
        label="Underline"
        active={editor.isActive('underline')}
        onClick={() => {
          editor.chain().focus().toggleUnderline().run();
        }}
      >
        <Underline />
      </ToolbarButton>
      <ToolbarButton label="Link" active={editor.isActive('link')} onClick={toggleLink}>
        <Link2 />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <ToolbarButton
        label="Bullet list"
        active={editor.isActive('bulletList')}
        onClick={() => {
          editor.chain().focus().toggleBulletList().run();
        }}
      >
        <List />
      </ToolbarButton>
      <ToolbarButton
        label="Ordered list"
        active={editor.isActive('orderedList')}
        onClick={() => {
          editor.chain().focus().toggleOrderedList().run();
        }}
      >
        <ListOrdered />
      </ToolbarButton>
      <ToolbarButton
        label="Blockquote"
        active={editor.isActive('blockquote')}
        onClick={() => {
          editor.chain().focus().toggleBlockquote().run();
        }}
      >
        <Quote />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <ToolbarButton
        label="Undo"
        onClick={() => {
          editor.chain().focus().undo().run();
        }}
      >
        <Undo2 />
      </ToolbarButton>
      <ToolbarButton
        label="Redo"
        onClick={() => {
          editor.chain().focus().redo().run();
        }}
      >
        <Redo2 />
      </ToolbarButton>
    </div>
  );
}
