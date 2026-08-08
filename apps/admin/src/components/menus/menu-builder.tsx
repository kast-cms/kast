'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import type { CreateMenuItemBody, MenuDetail, MenuItemSummary } from '@kast-cms/sdk';
import { ListTree, Plus } from 'lucide-react';
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {t('builder.tree.title')}
          <Badge variant="muted" size="sm">
            {items.length}
          </Badge>
        </CardTitle>
        <CardAction>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setAddingUnder(null);
            }}
          >
            <Plus />
            {t('builder.tree.addItem')}
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-3">
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
          <EmptyState
            Icon={ListTree}
            size="sm"
            title={t('builder.tree.empty')}
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setAddingUnder(null);
                }}
              >
                <Plus />
                {t('builder.tree.addItem')}
              </Button>
            }
          />
        )}

        {items.length > 0 && (
          <div className="flex flex-col gap-1">
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
        )}

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
      </CardContent>
    </Card>
  );
}

export function MenuBuilder({ initial }: MenuBuilderProps): JSX.Element {
  const t = useTranslations('menus');
  const router = useRouter();
  const { menuId, saving, saveError, name, slug, setName, setSlug, handleSave } =
    useMenuSave(initial);
  const { items, itemSaving, handleAddItem, handleDeleteItem } = useMenuItems(initial?.items ?? []);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={menuId ? t('builder.editTitle') : t('builder.newTitle')}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                router.push('/menus');
              }}
            >
              {t('builder.cancel')}
            </Button>
            <Button disabled={!name || !slug} loading={saving} onClick={handleSave}>
              {saving ? t('builder.saving') : t('builder.save')}
            </Button>
          </>
        }
      />

      {saveError !== '' && (
        <Alert variant="destructive">
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
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
          <div className="space-y-1.5">
            <Label htmlFor="menu-slug">{t('builder.fields.slug')}</Label>
            <Input
              id="menu-slug"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
              }}
              placeholder={t('builder.fields.slugPlaceholder')}
              className="font-mono text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {menuId !== '' && (
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
