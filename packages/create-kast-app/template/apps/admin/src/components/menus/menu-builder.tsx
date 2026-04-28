'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CreateMenuItemBody, MenuDetail, MenuItemSummary } from '@kast-cms/sdk';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, type JSX } from 'react';
import { MenuItemForm, MenuTreeNode } from './menu-tree';
import { useMenuItems } from './use-menu-items';
import { useMenuSave } from './use-menu-save';

interface MenuBuilderProps {
  initial?: MenuDetail;
}

interface TreeSectionProps {
  menuId: string;
  items: MenuItemSummary[];
  itemSaving: boolean;
  onAdd: (body: CreateMenuItemBody, parentId?: string) => void;
  onDelete: (itemId: string) => void;
}

function TreeSection({ items, itemSaving, onAdd, onDelete }: TreeSectionProps): JSX.Element {
  const t = useTranslations('menus');
  const [addingUnder, setAddingUnder] = useState<string | null | false>(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{t('builder.tree.title')}</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setAddingUnder(null);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t('builder.tree.addItem')}
        </Button>
      </div>
      {addingUnder === null && (
        <MenuItemForm
          saving={itemSaving}
          onCancel={() => {
            setAddingUnder(false);
          }}
          onSave={(body) => {
            onAdd(body, undefined);
            setAddingUnder(false);
          }}
        />
      )}
      {items.length === 0 && addingUnder === false && (
        <p className="text-center text-sm text-muted-foreground">{t('builder.tree.empty')}</p>
      )}
      <div className="space-y-1">
        {items.map((item) => (
          <MenuTreeNode
            key={item.id}
            item={item}
            depth={0}
            onAddChild={(parentId) => {
              setAddingUnder(parentId);
            }}
            onEdit={() => {
              /* handled inline */
            }}
            onDelete={(id) => {
              onDelete(id);
            }}
          />
        ))}
      </div>
      {typeof addingUnder === 'string' && addingUnder !== '' && (
        <MenuItemForm
          saving={itemSaving}
          onCancel={() => {
            setAddingUnder(false);
          }}
          onSave={(body) => {
            onAdd(body, addingUnder);
            setAddingUnder(false);
          }}
        />
      )}
    </div>
  );
}

export function MenuBuilder({ initial }: MenuBuilderProps): JSX.Element {
  const t = useTranslations('menus');
  const router = useRouter();
  const { menuId, saving, saveError, name, slug, setName, setSlug, handleSave } =
    useMenuSave(initial);
  const { items, itemSaving, handleAddItem, handleDeleteItem } = useMenuItems(initial?.items ?? []);

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-8">
      <div className="space-y-4 rounded-lg border p-6">
        <h2 className="text-lg font-semibold">
          {menuId ? t('builder.editTitle') : t('builder.newTitle')}
        </h2>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="menu-name">{t('builder.fields.name')}</Label>
            <Input
              id="menu-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
              }}
              placeholder={t('builder.fields.namePlaceholder')}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="menu-slug">{t('builder.fields.slug')}</Label>
            <Input
              id="menu-slug"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
              }}
              placeholder={t('builder.fields.slugPlaceholder')}
            />
          </div>
        </div>
        {saveError && <p className="text-sm text-destructive">{saveError}</p>}
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              router.push('/menus');
            }}
          >
            {t('builder.cancel')}
          </Button>
          <Button disabled={saving || !name || !slug} onClick={handleSave}>
            {saving ? t('builder.saving') : t('builder.save')}
          </Button>
        </div>
      </div>
      {menuId && (
        <TreeSection
          menuId={menuId}
          items={items}
          itemSaving={itemSaving}
          onAdd={(body, parentId) => {
            void handleAddItem(menuId, body, parentId);
          }}
          onDelete={(itemId) => {
            void handleDeleteItem(menuId, itemId);
          }}
        />
      )}
    </div>
  );
}
