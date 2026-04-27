import type { KastClient } from './client.js';
import type {
  CreateMenuBody,
  CreateMenuItemBody,
  MenuDetail,
  MenuItemSummary,
  MenuSummary,
  ReorderMenuItemsBody,
  UpdateMenuBody,
  UpdateMenuItemBody,
} from './menu-types.js';

export class MenusResource {
  constructor(private readonly client: KastClient) {}

  list(): Promise<MenuSummary[]> {
    return this.client.request('/api/v1/menus');
  }

  create(body: CreateMenuBody): Promise<MenuDetail> {
    return this.client.request('/api/v1/menus', { method: 'POST', body });
  }

  findByHandle(handle: string): Promise<MenuDetail> {
    return this.client.request(`/api/v1/menus/${encodeURIComponent(handle)}`);
  }

  findOne(id: string): Promise<MenuDetail> {
    return this.client.request(`/api/v1/menus/${encodeURIComponent(id)}`);
  }

  update(id: string, body: UpdateMenuBody): Promise<MenuDetail> {
    return this.client.request(`/api/v1/menus/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body,
    });
  }

  delete(id: string): Promise<void> {
    return this.client.request(`/api/v1/menus/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  addItem(menuId: string, body: CreateMenuItemBody): Promise<MenuItemSummary> {
    return this.client.request(`/api/v1/menus/${encodeURIComponent(menuId)}/items`, {
      method: 'POST',
      body,
    });
  }

  updateItem(menuId: string, itemId: string, body: UpdateMenuItemBody): Promise<MenuItemSummary> {
    return this.client.request(
      `/api/v1/menus/${encodeURIComponent(menuId)}/items/${encodeURIComponent(itemId)}`,
      { method: 'PATCH', body },
    );
  }

  deleteItem(menuId: string, itemId: string): Promise<void> {
    return this.client.request(
      `/api/v1/menus/${encodeURIComponent(menuId)}/items/${encodeURIComponent(itemId)}`,
      { method: 'DELETE' },
    );
  }

  reorder(menuId: string, body: ReorderMenuItemsBody): Promise<void> {
    return this.client.request(`/api/v1/menus/${encodeURIComponent(menuId)}/items/reorder`, {
      method: 'POST',
      body,
    });
  }
}
