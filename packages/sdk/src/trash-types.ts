export type TrashModel = 'content' | 'media' | 'user' | 'form';

export interface TrashedItem {
  id: string;
  model: TrashModel;
  name: string;
  trashedAt: string;
  trashedByUserId: string | null;
  /** Display name for {@link trashedByUserId}; null when no actor was recorded. */
  trashedByName: string | null;
  daysUntilDeletion: number;
}

export interface TrashListParams {
  model?: TrashModel;
  limit?: number;
  cursor?: string;
}

export interface TrashListResponse {
  items: TrashedItem[];
  total: number;
  /**
   * Opaque keyset cursor covering every model in the listing. Pass it back as
   * `cursor` to continue; null means the last page. Paging by anything else
   * lets whichever model is queried first fill the page.
   */
  nextCursor: string | null;
}
