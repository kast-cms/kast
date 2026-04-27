import type { KastClient } from './client.js';
import type {
  DashboardActivityEntry,
  DashboardQueueHealth,
  DashboardStats,
} from './dashboard-types.js';

export class DashboardResource {
  constructor(private readonly client: KastClient) {}

  getStats(): Promise<DashboardStats> {
    return this.client.request('/api/v1/dashboard/stats');
  }

  getActivity(): Promise<DashboardActivityEntry[]> {
    return this.client.request('/api/v1/dashboard/activity');
  }

  getQueueHealth(): Promise<DashboardQueueHealth[]> {
    return this.client.request('/api/v1/dashboard/queue-health');
  }
}
