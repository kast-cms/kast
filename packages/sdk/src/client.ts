import { AgentTokensResource } from './agent-tokens-resource.js';
import { AuditResource } from './audit-resource.js';
import { AuthResource, ContentTypesResource, HealthResource } from './content-types-resource.js';
import { DashboardResource } from './dashboard-resource.js';
import { FormsResource } from './forms-resource.js';
import { KastHttpClient } from './http-client.js';
import { LocalesResource } from './locales-resource.js';
import { MediaResource } from './media-resource.js';
import { MenusResource } from './menus-resource.js';
import { PluginsResource } from './plugins-resource.js';
import { RolesResource } from './roles-resource.js';
import { SeoResource } from './seo-resource.js';
import { SettingsResource } from './settings-resource.js';
import { TokensResource } from './tokens-resource.js';
import { TrashResource } from './trash-resource.js';
import type {
  ApiListResponse,
  ApiResponse,
  BulkActionBody,
  ContentEntryDetail,
  ContentEntrySummary,
  ContentEntryVersion,
  CreateEntryBody,
  EntryListParams,
  SchedulePublishBody,
  UpdateEntryBody,
  VersionListParams,
} from './types.js';
import { UsersResource } from './users-resource.js';
import { VersionsResource } from './versions-resource.js';
import { WebhooksResource } from './webhooks-resource.js';

export class KastClient extends KastHttpClient {
  get agentTokens(): AgentTokensResource {
    return new AgentTokensResource(this);
  }

  get auth(): AuthResource {
    return new AuthResource(this);
  }

  get plugins(): PluginsResource {
    return new PluginsResource(this);
  }

  get contentTypes(): ContentTypesResource {
    return new ContentTypesResource(this);
  }

  get content(): ContentResource {
    return new ContentResource(this);
  }

  get media(): MediaResource {
    return new MediaResource(this);
  }

  get users(): UsersResource {
    return new UsersResource(this);
  }

  get roles(): RolesResource {
    return new RolesResource(this);
  }

  get tokens(): TokensResource {
    return new TokensResource(this);
  }

  get webhooks(): WebhooksResource {
    return new WebhooksResource(this);
  }

  get health(): HealthResource {
    return new HealthResource(this);
  }

  get seo(): SeoResource {
    return new SeoResource(this);
  }

  get forms(): FormsResource {
    return new FormsResource(this);
  }

  get menus(): MenusResource {
    return new MenusResource(this);
  }

  get locales(): LocalesResource {
    return new LocalesResource(this);
  }

  get trash(): TrashResource {
    return new TrashResource(this);
  }

  /** @alias tokens — API token management */
  get apiTokens(): TokensResource {
    return new TokensResource(this);
  }

  get versions(): VersionsResource {
    return new VersionsResource(this);
  }

  get settings(): SettingsResource {
    return new SettingsResource(this);
  }

  get audit(): AuditResource {
    return new AuditResource(this);
  }

  get dashboard(): DashboardResource {
    return new DashboardResource(this);
  }
}

class ContentResource {
  constructor(private readonly client: KastClient) {}

  list(
    typeSlug: string,
    params: EntryListParams = {},
  ): Promise<ApiListResponse<ContentEntrySummary>> {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return this.client.request(`/api/v1/content-types/${typeSlug}/entries${qs ? `?${qs}` : ''}`);
  }

  get(typeSlug: string, id: string, locale?: string): Promise<ApiResponse<ContentEntryDetail>> {
    const qs = locale !== undefined ? `?locale=${locale}` : '';
    return this.client.request(`/api/v1/content-types/${typeSlug}/entries/${id}${qs}`);
  }

  create(typeSlug: string, data: CreateEntryBody): Promise<ApiResponse<ContentEntryDetail>> {
    return this.client.request(`/api/v1/content-types/${typeSlug}/entries`, {
      method: 'POST',
      body: data,
    });
  }

  update(
    typeSlug: string,
    id: string,
    data: UpdateEntryBody,
  ): Promise<ApiResponse<ContentEntryDetail>> {
    return this.client.request(`/api/v1/content-types/${typeSlug}/entries/${id}`, {
      method: 'PATCH',
      body: data,
    });
  }

  publish(typeSlug: string, id: string): Promise<ApiResponse<ContentEntryDetail>> {
    return this.client.request(`/api/v1/content-types/${typeSlug}/entries/${id}/publish`, {
      method: 'POST',
    });
  }

  unpublish(typeSlug: string, id: string): Promise<ApiResponse<ContentEntryDetail>> {
    return this.client.request(`/api/v1/content-types/${typeSlug}/entries/${id}/unpublish`, {
      method: 'POST',
    });
  }

  archive(typeSlug: string, id: string): Promise<ApiResponse<ContentEntryDetail>> {
    return this.client.request(`/api/v1/content-types/${typeSlug}/entries/${id}/archive`, {
      method: 'POST',
    });
  }

  restore(typeSlug: string, id: string): Promise<ApiResponse<ContentEntryDetail>> {
    return this.client.request(`/api/v1/content-types/${typeSlug}/entries/${id}/restore`, {
      method: 'POST',
    });
  }

  schedulePublish(
    typeSlug: string,
    id: string,
    body: SchedulePublishBody,
  ): Promise<ApiResponse<ContentEntryDetail>> {
    return this.client.request(`/api/v1/content-types/${typeSlug}/entries/${id}/schedule`, {
      method: 'POST',
      body,
    });
  }

  cancelSchedule(typeSlug: string, id: string): Promise<ApiResponse<ContentEntryDetail>> {
    return this.client.request(`/api/v1/content-types/${typeSlug}/entries/${id}/schedule`, {
      method: 'DELETE',
    });
  }

  trash(typeSlug: string, id: string): Promise<void> {
    return this.client.request(`/api/v1/content-types/${typeSlug}/entries/${id}`, {
      method: 'DELETE',
    });
  }

  bulkTrash(typeSlug: string, ids: string[]): Promise<void> {
    return this.client.request(`/api/v1/content-types/${typeSlug}/entries/bulk/trash`, {
      method: 'POST',
      body: { ids } satisfies BulkActionBody,
    });
  }

  bulkPublish(typeSlug: string, ids: string[]): Promise<void> {
    return this.client.request(`/api/v1/content-types/${typeSlug}/entries/bulk/publish`, {
      method: 'POST',
      body: { ids } satisfies BulkActionBody,
    });
  }

  bulkUnpublish(typeSlug: string, ids: string[]): Promise<void> {
    return this.client.request(`/api/v1/content-types/${typeSlug}/entries/bulk/unpublish`, {
      method: 'POST',
      body: { ids } satisfies BulkActionBody,
    });
  }

  listVersions(
    typeSlug: string,
    id: string,
    params: VersionListParams = {},
  ): Promise<ApiListResponse<ContentEntryVersion>> {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return this.client.request(
      `/api/v1/content-types/${typeSlug}/entries/${id}/versions${qs ? `?${qs}` : ''}`,
    );
  }

  getVersion(
    typeSlug: string,
    id: string,
    versionId: string,
  ): Promise<ApiResponse<ContentEntryVersion>> {
    return this.client.request(
      `/api/v1/content-types/${typeSlug}/entries/${id}/versions/${versionId}`,
    );
  }

  revert(
    typeSlug: string,
    id: string,
    versionId: string,
  ): Promise<ApiResponse<ContentEntryDetail>> {
    return this.client.request(
      `/api/v1/content-types/${typeSlug}/entries/${id}/versions/${versionId}/revert`,
      { method: 'POST' },
    );
  }
}
