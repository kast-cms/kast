'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Hint } from '@/components/ui/tooltip';
import { useApiClient, useSession } from '@/lib/session';
import { cn } from '@/lib/utils';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { AddFieldBody, ContentField, ContentTypeDetail, UpdateFieldBody } from '@kast-cms/sdk';
import { GripVertical, Pencil, Plus, Rows3, Trash2 } from 'lucide-react';
import { useCallback, useState, type JSX } from 'react';
import { FieldDrawer } from './field-drawer';
import { reorderFieldsForDrag, sortFieldsByPosition } from './field-order';

/**
 * Field type is a categorical dimension, not a status — a URL field is not
 * "info" and an enum is not "success" — so the chips draw from the chart ramp
 * instead of the status palette. Related types share a hue so the list reads in
 * families (text-ish, numeric, boolean-ish, references, binary, structured).
 */
const FIELD_TYPE_DOT: Record<string, string> = {
  TEXT: 'bg-chart-1',
  RICH_TEXT: 'bg-chart-1',
  NUMBER: 'bg-chart-4',
  DATE: 'bg-chart-4',
  DATETIME: 'bg-chart-4',
  BOOLEAN: 'bg-chart-3',
  SELECT: 'bg-chart-3',
  MULTI_SELECT: 'bg-chart-3',
  EMAIL: 'bg-chart-2',
  URL: 'bg-chart-2',
  RELATION: 'bg-chart-2',
  MEDIA: 'bg-chart-6',
  COLOR: 'bg-chart-6',
  JSON: 'bg-chart-5',
  COMPONENT: 'bg-chart-5',
  BLOCK: 'bg-chart-5',
};

interface SortableFieldRowProps {
  field: ContentField;
  onEdit: (field: ContentField) => void;
  onDelete: (fieldName: string) => void;
}

function SortableFieldRow({ field, onEdit, onDelete }: SortableFieldRowProps): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.name,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const dotClass = FIELD_TYPE_DOT[field.type] ?? 'bg-muted-foreground';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative flex items-start gap-3 rounded-lg border bg-card px-3 py-2.5',
        'transition-[border-color,background-color,box-shadow] duration-150 ease-out-quad',
        // Lifted and ringed while it travels, so the row being moved is never
        // confused with the gap it left behind.
        isDragging
          ? 'z-10 border-primary/40 shadow-lg ring-1 ring-ring/20'
          : 'border-border shadow-2xs hover:border-border-strong hover:bg-accent/40',
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className={cn(
          'grid size-7 shrink-0 cursor-grab touch-none place-items-center rounded-md',
          'text-muted-foreground/60 transition-colors duration-150 ease-out-quad',
          'hover:bg-muted hover:text-foreground active:cursor-grabbing',
          'outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-card',
          isDragging && 'cursor-grabbing bg-muted text-foreground',
        )}
        aria-label={`Reorder ${field.displayName}`}
      >
        <GripVertical className="size-4" />
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-1 py-0.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-sm font-medium text-foreground">{field.displayName}</span>
          {field.isRequired && (
            <Badge variant="outline" size="sm">
              Required
            </Badge>
          )}
          {field.isUnique && (
            <Badge variant="outline" size="sm">
              Unique
            </Badge>
          )}
          {field.isLocalized && (
            <Badge variant="outline" size="sm">
              i18n
            </Badge>
          )}
          {field.isHidden && (
            <Badge variant="muted" size="sm">
              Hidden
            </Badge>
          )}
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-muted px-1.5 py-0.5 font-mono text-2xs font-medium tracking-wider text-muted-foreground uppercase">
            <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', dotClass)} />
            {field.type}
          </span>
          <code className="truncate font-mono text-xs text-muted-foreground">{field.name}</code>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Hint label="Edit field">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              onEdit(field);
            }}
            aria-label={`Edit ${field.displayName}`}
          >
            <Pencil />
          </Button>
        </Hint>
        <Hint label="Delete field">
          <Button
            variant="ghost-destructive"
            size="icon-sm"
            onClick={() => {
              onDelete(field.name);
            }}
            aria-label={`Delete ${field.displayName}`}
          >
            <Trash2 />
          </Button>
        </Hint>
      </div>
    </div>
  );
}

interface FieldBuilderProps {
  contentType: ContentTypeDetail;
  onUpdate: (updated: ContentTypeDetail) => void;
}

export function FieldBuilder({ contentType, onUpdate }: FieldBuilderProps): JSX.Element {
  const client = useApiClient();
  const { session } = useSession();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingField, setEditingField] = useState<ContentField | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleAddField = useCallback(() => {
    setEditingField(null);
    setDrawerOpen(true);
  }, []);

  const handleEditField = useCallback((field: ContentField) => {
    setEditingField(field);
    setDrawerOpen(true);
  }, []);

  const handleDrawerSave = useCallback(
    async (data: AddFieldBody | UpdateFieldBody, fieldName?: string) => {
      if (fieldName !== undefined) {
        await client.contentTypes.updateField(contentType.name, fieldName, data as UpdateFieldBody);
      } else {
        await client.contentTypes.addField(contentType.name, data as AddFieldBody);
      }
      const updated = await client.contentTypes.get(contentType.name);
      onUpdate(updated.data);
    },
    [session, contentType.name, onUpdate, client],
  );

  const handleDeleteField = useCallback(
    async (fieldName: string) => {
      await client.contentTypes.deleteField(contentType.name, fieldName);
      onUpdate({
        ...contentType,
        fields: contentType.fields.filter((f) => f.name !== fieldName),
      });
    },
    [session, contentType, onUpdate, client],
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (over === null) return;

      const reordered = reorderFieldsForDrag(
        contentType.fields,
        String(active.id),
        String(over.id),
      );
      if (reordered === null) return;

      // Optimistic update
      onUpdate({ ...contentType, fields: reordered });

      try {
        const saved = await client.contentTypes.reorderFields(contentType.name, {
          order: reordered.map((f) => f.name),
        });
        // The route answers with the refreshed type, so the positions on screen
        // are the ones the database now holds rather than a local guess.
        onUpdate(saved.data);
      } catch {
        // Revert on error
        onUpdate(contentType);
      }
    },
    [session, contentType, onUpdate, client],
  );

  const sortedFields = sortFieldsByPosition(contentType.fields);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Fields
            <Badge variant="muted" size="sm">
              {sortedFields.length}
            </Badge>
          </CardTitle>
          <CardDescription>
            The shape of every entry. Drag a row by its handle to change the order fields appear in.
          </CardDescription>
          <CardAction>
            <Button size="sm" onClick={handleAddField}>
              <Plus />
              Add field
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent>
          {sortedFields.length === 0 ? (
            <EmptyState
              Icon={Rows3}
              size="sm"
              title="No fields yet"
              description="Add your first field to define the structure of this content type."
              action={
                <Button size="sm" variant="outline" onClick={handleAddField}>
                  <Plus />
                  Add field
                </Button>
              }
            />
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(e) => {
                void handleDragEnd(e);
              }}
            >
              <SortableContext
                items={sortedFields.map((f) => f.name)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-2">
                  {sortedFields.map((field) => (
                    <SortableFieldRow
                      key={field.name}
                      field={field}
                      onEdit={handleEditField}
                      onDelete={(name) => {
                        void handleDeleteField(name);
                      }}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      <FieldDrawer
        open={drawerOpen}
        field={editingField}
        onClose={() => {
          setDrawerOpen(false);
        }}
        onSave={handleDrawerSave}
      />
    </>
  );
}
