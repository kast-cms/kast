---
title: SDK Reference
description: Complete method reference for the Kast SDK client.
sidebar:
  order: 13
---

## KastClient constructor

```ts
import { KastClient } from '@kast/sdk';

const kast = new KastClient({
  baseUrl: 'https://api.example.com', // required
  apiKey: 'kast_...', // delivery key or management key
  accessToken: 'eyJ...', // JWT — alternative to apiKey
  fetch: customFetch, // optional fetch override (e.g. undici)
});
```

| Option        | Type           | Notes                                                           |
| ------------- | -------------- | --------------------------------------------------------------- |
| `baseUrl`     | `string`       | Your Kast API origin. Trailing slash is stripped.               |
| `apiKey`      | `string`       | `X-Kast-Key` header. Use a delivery key for public reads.       |
| `accessToken` | `string`       | `Authorization: Bearer` header. Takes precedence over `apiKey`. |
| `fetch`       | `typeof fetch` | Inject a custom fetch implementation.                           |

### `setAccessToken(token)`

Replace the current access token at runtime (e.g. after a refresh):

```ts
kast.setAccessToken(newAccessToken);
```

---

## Resource map

| Property            | Resource                         | Docs                                 |
| ------------------- | -------------------------------- | ------------------------------------ |
| `kast.content`      | Content entries CRUD + lifecycle | [Content Entries](./content-entries) |
| `kast.contentTypes` | Schema management                | [Content Types](./content-types)     |
| `kast.media`        | File upload and management       | [Media](./media)                     |
| `kast.seo`          | SEO metadata and scoring         | [SEO](./seo)                         |
| `kast.users`        | User management                  | [Users & Roles](./users-roles)       |
| `kast.roles`        | Role listing                     | [Users & Roles](./users-roles)       |
| `kast.tokens`       | API token management             | [Users & Roles](./users-roles)       |
| `kast.agentTokens`  | Agent token management           | [Users & Roles](./users-roles)       |
| `kast.webhooks`     | Webhook CRUD + delivery logs     | [Webhooks](./webhooks)               |
| `kast.forms`        | Form CRUD + submissions          | [Forms](./forms)                     |
| `kast.menus`        | Navigation menu management       | [Menus](./menus)                     |
| `kast.versions`     | Entry version history            | [Versions](./versions)               |
| `kast.trash`        | Trash list, restore, purge       | [Trash](./trash)                     |
| `kast.auth`         | Login, refresh, OAuth            | [Authentication](./authentication)   |
| `kast.health`       | Health check                     | —                                    |
| `kast.settings`     | Global settings                  | —                                    |
| `kast.audit`        | Audit log + CSV export           | —                                    |
| `kast.dashboard`    | Dashboard stats                  | —                                    |

---

## content

```ts
kast.content.list(typeSlug, params?)           → ApiListResponse<ContentEntrySummary>
kast.content.get(typeSlug, id, locale?)        → ApiResponse<ContentEntryDetail>
kast.content.create(typeSlug, body)            → ApiResponse<ContentEntryDetail>
kast.content.update(typeSlug, id, body)        → ApiResponse<ContentEntryDetail>
kast.content.publish(typeSlug, id)             → ApiResponse<ContentEntryDetail>
kast.content.unpublish(typeSlug, id)           → ApiResponse<ContentEntryDetail>
kast.content.archive(typeSlug, id)             → ApiResponse<ContentEntryDetail>
kast.content.restore(typeSlug, id)             → ApiResponse<ContentEntryDetail>
kast.content.schedulePublish(typeSlug, id, {publishAt}) → ApiResponse<ContentEntryDetail>
kast.content.cancelSchedule(typeSlug, id)      → ApiResponse<ContentEntryDetail>
kast.content.trash(typeSlug, id)               → void
kast.content.bulkTrash(typeSlug, ids)          → void
kast.content.bulkPublish(typeSlug, ids)        → void
kast.content.bulkUnpublish(typeSlug, ids)      → void
kast.content.listVersions(typeSlug, id)        → ApiListResponse<ContentEntryVersion>
kast.content.getVersion(typeSlug, id, vId)     → ApiResponse<ContentEntryVersion>
kast.content.revert(typeSlug, id, vId)         → ApiResponse<ContentEntryDetail>
```

## contentTypes

```ts
kast.contentTypes.list()                        → ApiListResponse<ContentTypeSummary>
kast.contentTypes.get(typeSlug)                 → ApiResponse<ContentTypeDetail>
kast.contentTypes.create(body)                  → ApiResponse<ContentTypeDetail>
kast.contentTypes.update(typeSlug, body)        → ApiResponse<ContentTypeDetail>
kast.contentTypes.delete(typeSlug)              → void
kast.contentTypes.addField(typeSlug, body)      → ApiResponse<ContentField>
kast.contentTypes.updateField(typeSlug, fieldKey, body) → ApiResponse<ContentField>
kast.contentTypes.deleteField(typeSlug, fieldKey)       → void
kast.contentTypes.reorderFields(typeSlug, body) → void
```

## media

```ts
kast.media.upload(formData)                     → ApiResponse<MediaFileDetail>
kast.media.list(params?)                        → ApiListResponse<MediaFileSummary>
kast.media.get(fileId)                          → ApiResponse<MediaFileDetail>
kast.media.update(fileId, body)                 → ApiResponse<MediaFileDetail>
kast.media.delete(fileId)                       → void
kast.media.listFolders()                        → ApiListResponse<MediaFolder>
kast.media.createFolder(body)                   → ApiResponse<MediaFolder>
kast.media.deleteFolder(folderId)               → void
```

## seo

```ts
kast.seo.get(entryId)                           → ApiResponse<SeoMeta>
kast.seo.update(entryId, body)                  → ApiResponse<SeoMeta>
kast.seo.getScore(entryId)                      → ApiResponse<SeoScore>
kast.seo.validate(entryId)                      → void
kast.seo.getSitemap()                           → ApiListResponse<SitemapEntry>
kast.seo.list(params?)                          → ApiListResponse<SeoMeta>
```

## forms

```ts
kast.forms.list()                               → ApiListResponse<FormSummary>
kast.forms.get(formId)                          → ApiResponse<FormDetail>
kast.forms.create(body)                         → ApiResponse<FormDetail>
kast.forms.update(formId, body)                 → ApiResponse<FormDetail>
kast.forms.delete(formId)                       → void
kast.forms.submit(formId, data)                 → void   // no auth required
kast.forms.listSubmissions(formId, params?)     → PaginatedSubmissions
kast.forms.exportSubmissions(formId)            → Blob   // CSV
```

## menus

```ts
kast.menus.list()                               → MenuSummary[]
kast.menus.create(body)                         → MenuDetail
kast.menus.get(menuId)                          → MenuDetail
kast.menus.findByHandle(slug)                   → MenuDetail
kast.menus.update(menuId, body)                 → MenuDetail
kast.menus.delete(menuId)                       → void
kast.menus.addItem(menuId, body)                → MenuItemSummary
kast.menus.updateItem(menuId, itemId, body)     → MenuItemSummary
kast.menus.deleteItem(menuId, itemId)           → void
kast.menus.reorder(menuId, body)                → void
```

## webhooks

```ts
kast.webhooks.list()                            → ApiListResponse<WebhookSummary>
kast.webhooks.create(body)                      → WebhookCreated
kast.webhooks.update(hookId, body)              → WebhookSummary
kast.webhooks.delete(hookId)                    → void
kast.webhooks.listDeliveries(hookId, params?)   → ApiListResponse<WebhookDeliverySummary>
kast.webhooks.retryDelivery(hookId, deliveryId) → void
```

## versions

```ts
kast.versions.list(typeSlug, entryId, params?)  → ApiListResponse<ContentEntryVersion>
kast.versions.get(typeSlug, entryId, versionId) → ApiResponse<ContentEntryVersion>
kast.versions.revert(typeSlug, entryId, vId)    → ApiResponse<ContentEntryDetail>
```

## trash

```ts
kast.trash.list(params?)                        → TrashListResponse
kast.trash.restore(model, id)                   → void
kast.trash.permanentDelete(model, id)           → void
```

## users / roles / tokens

```ts
kast.users.list(params?)                        → ApiListResponse<UserSummary>
kast.users.get(userId)                          → ApiResponse<UserSummary>
kast.users.invite(body)                         → void
kast.users.update(userId, body)                 → ApiResponse<UserSummary>
kast.users.delete(userId)                       → void

kast.roles.list()                               → ApiListResponse<RoleSummary>

kast.tokens.list()                              → ApiListResponse<ApiTokenSummary>
kast.tokens.create(body)                        → ApiTokenCreated
kast.tokens.revoke(tokenId)                     → void

kast.agentTokens.list()                         → ApiListResponse<AgentTokenSummary>
kast.agentTokens.create(body)                   → AgentTokenCreated
kast.agentTokens.revoke(tokenId)                → void
```

## auth

```ts
kast.auth.login(email, password)                → { accessToken, refreshToken }
kast.auth.refresh(refreshToken)                 → { accessToken }
kast.auth.logout()                              → void
kast.auth.me()                                  → ApiResponse<UserSummary>
kast.auth.getOAuthUrl(provider)                 → { url: string }   // 'google' | 'github'
```

## audit

```ts
kast.audit.list(params?)                        → AuditLogListResponse
kast.audit.export(params?)                      → Blob   // CSV
```

---

## Error handling

All methods throw on non-2xx. The error is a standard `Error` with two extra properties:

```ts
try {
  await kast.content.publish('blog-post', entryId);
} catch (err: any) {
  console.log(err.message); // human-readable message from the API
  console.log(err.status); // HTTP status code
  console.log(err.code); // machine-readable error code (if provided)
}
```

Common codes: `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `VALIDATION_ERROR` (422).
