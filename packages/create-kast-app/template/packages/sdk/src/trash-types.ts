export type TrashModel = 'content' | 'media' | 'user' | 'form';

export interface TrashedItem {
  id: string;
  model: TrashModel;
  name: string;
  trashedAt: string;
  trashedByUserId: string | null;
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
}
