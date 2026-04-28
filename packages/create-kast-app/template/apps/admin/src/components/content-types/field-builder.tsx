'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { createApiClient } from '@/lib/api';
import { useSession } from '@/lib/session';
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
import { GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { useCallback, useState, type JSX } from 'react';
import { FieldDrawer } from './field-drawer';

const FIELD_TYPE_COLORS: Record<string, string> = {
  TEXT: 'bg-blue-100 text-blue-800',
  RICH_TEXT: 'bg-purple-100 text-purple-800',
  NUMBER: 'bg-yellow-100 text-yellow-800',
  BOOLEAN: 'bg-green-100 text-green-800',
  DATE: 'bg-orange-100 text-orange-800',
  MEDIA: 'bg-pink-100 text-pink-800',
  RELATION: 'bg-cyan-100 text-cyan-800',
  JSON: 'bg-gray-100 text-gray-800',
  EMAIL: 'bg-indigo-100 text-indigo-800',
  URL: 'bg-teal-100 text-teal-800',
  ENUM: 'bg-rose-100 text-rose-800',
  UID: 'bg-lime-100 text-lime-800',
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
    opacity: isDragging ? 0.5 : 1,
  };

  const colorClass = FIELD_TYPE_COLORS[field.type] ?? 'bg-gray-100 text-gray-800';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-x-3 rounded-md border bg-background px-4 py-3"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="flex flex-1 items-center gap-x-3 overflow-hidden">
        <span className="truncate font-medium text-sm">{field.displayName}</span>
        <code className="text-xs text-muted-foreground">{field.name}</code>
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
          {field.type}
        </span>
        {field.isRequired && (
          <Badge variant="outline" className="text-xs">
            Required
          </Badge>
        )}
        {field.isLocalized && (
          <Badge variant="outline" className="text-xs">
            i18n
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-x-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onEdit(field);
          }}
          aria-label={`Edit ${field.displayName}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onDelete(field.name);
          }}
          aria-label={`Delete ${field.displayName}`}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

interface FieldBuilderProps {
  contentType: ContentTypeDetail;
  onUpdate: (updated: ContentTypeDetail) => void;
}

export function FieldBuilder({ contentType, onUpdate }: FieldBuilderProps): JSX.Element {
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
      const client = createApiClient(session?.accessToken);
      if (fieldName !== undefined) {
        await client.contentTypes.updateField(contentType.name, fieldName, data as UpdateFieldBody);
      } else {
        await client.contentTypes.addField(contentType.name, data as AddFieldBody);
      }
      const updated = await client.contentTypes.get(contentType.name);
      onUpdate(updated.data);
    },
    [session, contentType.name, onUpdate],
  );

  const handleDeleteField = useCallback(
    async (fieldName: string) => {
      const client = createApiClient(session?.accessToken);
      await client.contentTypes.deleteField(contentType.name, fieldName);
      onUpdate({
        ...contentType,
        fields: contentType.fields.filter((f) => f.name !== fieldName),
      });
    },
    [session, contentType, onUpdate],
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (over === null || active.id === over.id) return;

      const fields = contentType.fields;
      const oldIndex = fields.findIndex((f) => f.name === active.id);
      const newIndex = fields.findIndex((f) => f.name === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = [...fields];
      const [moved] = reordered.splice(oldIndex, 1);
      if (moved === undefined) return;
      reordered.splice(newIndex, 0, moved);

      // Optimistic update
      onUpdate({ ...contentType, fields: reordered });

      try {
        const client = createApiClient(session?.accessToken);
        await client.contentTypes.reorderFields(contentType.name, {
          order: reordered.map((f) => f.name),
        });
      } catch {
        // Revert on error
        onUpdate(contentType);
      }
    },
    [session, contentType, onUpdate],
  );

  const sortedFields = [...contentType.fields].sort((a, b) => a.position - b.position);

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Fields</h2>
        <Button size="sm" onClick={handleAddField}>
          <Plus className="me-1.5 h-4 w-4" />
          Add field
        </Button>
      </div>

      {sortedFields.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <p className="text-sm font-medium">No fields yet</p>
          <p className="text-xs text-muted-foreground">
            Add your first field to define the structure.
          </p>
        </div>
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
            <div className="flex flex-col gap-y-2">
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

      <FieldDrawer
        open={drawerOpen}
        field={editingField}
        onClose={() => {
          setDrawerOpen(false);
        }}
        onSave={handleDrawerSave}
      />
    </div>
  );
}
