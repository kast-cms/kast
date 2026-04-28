# KAST CMS — Database Schema

### _Every table. Every field. Every relation. Nothing missing._

> Schema version: 0.1 — Prisma + PostgreSQL — April 2026

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Cross-Cutting Conventions](#2-cross-cutting-conventions)
3. [What Prisma Does NOT Own](#3-what-prisma-does-not-own)
4. [Entity Map (All 38 Models)](#4-entity-map-all-38-models)
5. [Full Prisma Schema](#5-full-prisma-schema)
6. [ER Diagram](#6-er-diagram)
7. [Index Strategy](#7-index-strategy)
8. [Key Design Decisions](#8-key-design-decisions)

---

## 1. Design Principles

| Principle         | Decision                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| **ID strategy**   | `cuid2` on every model — URL-safe, collision-resistant, globally unique                           |
| **Timestamps**    | `createdAt` on every model. `updatedAt` on every mutable model                                    |
| **Soft delete**   | Trash system on content, users, media, forms. 30-day recovery. Hard delete by BullMQ              |
| **Table naming**  | `snake_case` via `@@map()` — Prisma models are PascalCase, DB tables are snake_case               |
| **Enums**         | Defined in Prisma, stored as strings in PostgreSQL                                                |
| **JSON fields**   | Used for flexible content data, plugin config, and agent scopes                                   |
| **Relations**     | Explicit foreign keys everywhere — no implicit Prisma magic                                       |
| **Multi-tenancy** | Not in v1. Schema is designed so `tenantId` can be added per-table later without breaking changes |

---

## 2. Cross-Cutting Conventions

### Every model gets:

```
id         String   @id @default(cuid())
createdAt  DateTime @default(now())
```

### Every mutable model also gets:

```
updatedAt  DateTime @updatedAt
```

### Models that support trash get:

```
trashedAt     DateTime?
trashedByUserId String?
trashedByUser   User? @relation(...)
```

### Trash rules (enforced at service layer, not DB):

- Only `SUPER_ADMIN` and `ADMIN` roles can restore
- BullMQ `kast.trash` queue permanently deletes after 30 days
- Trashed records are excluded from all public API queries by default
- Audit log records the trash and restore events

---

## 3. What Prisma Does NOT Own

These are managed by BullMQ + Redis, not PostgreSQL:

| Concern                    | Handled By            |
| -------------------------- | --------------------- |
| Webhook delivery queue     | BullMQ `kast.webhook` |
| Media processing queue     | BullMQ `kast.media`   |
| SEO validation queue       | BullMQ `kast.seo`     |
| Scheduled publishing queue | BullMQ `kast.publish` |
| Trash cleanup (30-day)     | BullMQ `kast.trash`   |
| Email queue                | BullMQ `kast.email`   |
| Audit log async writes     | BullMQ `kast.audit`   |
| API response cache         | Redis directly        |
| Active BullMQ job state    | Redis directly        |

**Nothing above lives in PostgreSQL.** Prisma only owns persistent business data.

---

## 4. Entity Map (All 38 Models)

### Content (6 models)

| Model                 | Purpose                                                 |
| --------------------- | ------------------------------------------------------- |
| `ContentType`         | Definition of a content type (blog-post, product, page) |
| `ContentField`        | Field definitions on a content type                     |
| `ContentEntry`        | The actual content records                              |
| `ContentEntryLocale`  | Per-locale data for an entry                            |
| `ContentEntryVersion` | Snapshots of an entry for version history               |
| `ContentRelation`     | Many-to-many relations between entries                  |

### SEO (4 models)

| Model      | Purpose                                                |
| ---------- | ------------------------------------------------------ |
| `SeoMeta`  | Per-entry SEO fields (title, description, OG, Twitter) |
| `Redirect` | 301/302 redirect rules                                 |
| `SeoScore` | Historical validation score per entry                  |
| `SeoIssue` | Individual issues from a validation run                |

### Auth (7 models)

| Model            | Purpose                                                  |
| ---------------- | -------------------------------------------------------- |
| `User`           | Admin users                                              |
| `Role`           | Named roles (Super Admin, Admin, Editor, Viewer, custom) |
| `Permission`     | Granular permission definitions                          |
| `UserRole`       | Junction: user ↔ role                                    |
| `RolePermission` | Junction: role ↔ permission                              |
| `OAuthAccount`   | Connected Google/GitHub OAuth accounts                   |
| `RefreshToken`   | JWT refresh tokens                                       |
| `ApiToken`       | Long-lived API tokens                                    |

### Media (3 models)

| Model         | Purpose                               |
| ------------- | ------------------------------------- |
| `MediaFolder` | Folder hierarchy for organizing files |
| `MediaFile`   | Uploaded files with all metadata      |
| `MediaUsage`  | Which content entries use which files |

### MCP / AI Agents (2 models)

| Model          | Purpose                                |
| -------------- | -------------------------------------- |
| `AgentToken`   | MCP-specific RBAC tokens for AI agents |
| `AgentSession` | Log of MCP sessions and tools used     |

### i18n (1 model)

| Model    | Purpose                                               |
| -------- | ----------------------------------------------------- |
| `Locale` | Supported languages with direction and fallback chain |

### Audit (1 model)

| Model      | Purpose                                        |
| ---------- | ---------------------------------------------- |
| `AuditLog` | Immutable record of every action in the system |

### Webhooks (2 models)

| Model             | Purpose                                  |
| ----------------- | ---------------------------------------- |
| `WebhookEndpoint` | Configured outbound webhook destinations |
| `WebhookDelivery` | Delivery log for every webhook attempt   |

### Plugins (2 models)

| Model          | Purpose                                               |
| -------------- | ----------------------------------------------------- |
| `Plugin`       | Installed plugins and their status                    |
| `PluginConfig` | Per-plugin configuration (encrypted at service layer) |

### Forms (3 models)

| Model            | Purpose                         |
| ---------------- | ------------------------------- |
| `Form`           | Form definitions                |
| `FormField`      | Field definitions within a form |
| `FormSubmission` | Submitted form data             |

### Navigation (2 models)

| Model      | Purpose                     |
| ---------- | --------------------------- |
| `Menu`     | Named navigation menus      |
| `MenuItem` | Tree of links within a menu |

### Settings (1 model)

| Model           | Purpose                                       |
| --------------- | --------------------------------------------- |
| `GlobalSetting` | Key-value store for global site configuration |

### AI (2 models)

| Model                 | Purpose                         |
| --------------------- | ------------------------------- |
| `AiContentGeneration` | Log of AI text generation jobs  |
| `AiImageGeneration`   | Log of AI image generation jobs |

---

## 5. Full Prisma Schema

```prisma
// ============================================================
// KAST CMS — schema.prisma
// Database: PostgreSQL
// ORM: Prisma
// Version: 0.1
// ============================================================

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}


// ============================================================
// ENUMS
// ============================================================

enum ContentFieldType {
  TEXT
  RICH_TEXT
  NUMBER
  BOOLEAN
  DATE
  DATETIME
  MEDIA
  RELATION
  JSON
  COMPONENT
  BLOCK
  SELECT
  MULTI_SELECT
  COLOR
  URL
  EMAIL
}

enum ContentStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
  SCHEDULED
  TRASHED
}

enum RedirectType {
  PERMANENT  // 301
  TEMPORARY  // 302
}

enum IssueSeverity {
  ERROR
  WARNING
  INFO
}

enum TokenScope {
  READ_ONLY
  FULL_ACCESS
  SCOPED
}

enum TextDirection {
  LTR
  RTL
}

enum FormFieldType {
  TEXT
  EMAIL
  PHONE
  NUMBER
  TEXTAREA
  SELECT
  MULTI_SELECT
  CHECKBOX
  RADIO
  FILE
  DATE
}

enum AiJobStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

enum AiTriggerType {
  MANUAL   // user clicked "Generate with AI"
  AGENT    // MCP agent triggered it
  AUTO     // system-triggered (e.g., auto alt-text on upload)
}


// ============================================================
// CONTENT MODULE
// ============================================================

model ContentType {
  id          String   @id @default(cuid())
  name        String   @unique  // slug: "blog-post", "product"
  displayName String            // "Blog Post"
  description String?
  icon        String?           // icon name or emoji
  isSystem    Boolean  @default(false) // system types cannot be deleted

  fields      ContentField[]
  entries     ContentEntry[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("content_types")
}

model ContentField {
  id            String          @id @default(cuid())
  contentTypeId String
  contentType   ContentType     @relation(fields: [contentTypeId], references: [id], onDelete: Cascade)

  name          String          // slug: "body", "hero_image"
  displayName   String          // "Body", "Hero Image"
  type          ContentFieldType
  isRequired    Boolean         @default(false)
  isLocalized   Boolean         @default(false) // false = same across all locales
  isUnique      Boolean         @default(false)
  isHidden      Boolean         @default(false) // hide from admin UI
  position      Int             @default(0)     // display ordering
  config        Json            @default("{}") // type-specific: maxLength, allowedTypes, etc.
  defaultValue  Json?

  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  @@unique([contentTypeId, name])
  @@index([contentTypeId])
  @@map("content_fields")
}

model ContentEntry {
  id            String        @id @default(cuid())
  contentTypeId String
  contentType   ContentType   @relation(fields: [contentTypeId], references: [id])

  status        ContentStatus @default(DRAFT)
  publishedAt   DateTime?
  scheduledAt   DateTime?     // used by BullMQ kast.publish queue

  // AI flag
  isAiGenerated Boolean       @default(false)

  // Authorship
  createdById   String
  createdBy     User          @relation("CreatedEntries", fields: [createdById], references: [id])
  updatedById   String?
  updatedBy     User?         @relation("UpdatedEntries", fields: [updatedById], references: [id])

  // Trash
  trashedAt        DateTime?
  trashedByUserId  String?
  trashedByUser    User?      @relation("TrashedEntries", fields: [trashedByUserId], references: [id])

  locales       ContentEntryLocale[]
  versions      ContentEntryVersion[]
  seoMeta       SeoMeta?
  mediaUsages   MediaUsage[]
  aiGenerations AiContentGeneration[]

  relatedFrom   ContentRelation[] @relation("RelationFrom")
  relatedTo     ContentRelation[] @relation("RelationTo")

  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  @@index([contentTypeId, status])
  @@index([trashedAt])
  @@index([scheduledAt])
  @@map("content_entries")
}

model ContentEntryLocale {
  id           String       @id @default(cuid())
  entryId      String
  entry        ContentEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)
  localeCode   String
  locale       Locale       @relation(fields: [localeCode], references: [code])

  slug         String       // URL slug for this locale
  data         Json         // { fieldName: value, ... } for all localized fields

  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  @@unique([entryId, localeCode])
  @@unique([localeCode, slug])
  @@index([entryId])
  @@map("content_entry_locales")
}

model ContentEntryVersion {
  id            String       @id @default(cuid())
  entryId       String
  entry         ContentEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)

  versionNumber Int
  status        ContentStatus            // status at time of snapshot
  data          Json                     // full snapshot of non-localized fields
  localesData   Json                     // full snapshot of all locales { en: {...}, ar: {...} }
  isAiGenerated Boolean      @default(false)

  savedById     String
  savedBy       User         @relation(fields: [savedById], references: [id])

  createdAt     DateTime     @default(now())

  @@unique([entryId, versionNumber])
  @@index([entryId])
  @@map("content_entry_versions")
}

model ContentRelation {
  id        String       @id @default(cuid())
  fromId    String
  from      ContentEntry @relation("RelationFrom", fields: [fromId], references: [id], onDelete: Cascade)
  toId      String
  to        ContentEntry @relation("RelationTo", fields: [toId], references: [id], onDelete: Cascade)
  fieldName String       // which relation field on the ContentType
  position  Int          @default(0)

  @@unique([fromId, toId, fieldName])
  @@index([fromId])
  @@index([toId])
  @@map("content_relations")
}


// ============================================================
// SEO MODULE
// ============================================================

model SeoMeta {
  id              String       @id @default(cuid())
  entryId         String       @unique
  entry           ContentEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)

  metaTitle       String?
  metaDescription String?
  ogTitle         String?
  ogDescription   String?
  ogImageId       String?
  ogImage         MediaFile?   @relation("OgImage", fields: [ogImageId], references: [id])
  twitterTitle    String?
  twitterDesc     String?
  twitterImageId  String?
  twitterImage    MediaFile?   @relation("TwitterImage", fields: [twitterImageId], references: [id])
  canonicalUrl    String?
  noIndex         Boolean      @default(false)
  noFollow        Boolean      @default(false)
  structuredData  Json?        // JSON-LD blob

  scores          SeoScore[]

  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  @@map("seo_meta")
}

model Redirect {
  id          String       @id @default(cuid())
  fromPath    String       @unique
  toPath      String
  type        RedirectType @default(PERMANENT)
  isActive    Boolean      @default(true)
  hitCount    Int          @default(0)  // how many times this redirect was used

  createdById String
  createdBy   User         @relation(fields: [createdById], references: [id])

  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  @@index([fromPath, isActive])
  @@map("redirects")
}

model SeoScore {
  id          String    @id @default(cuid())
  seoMetaId   String
  seoMeta     SeoMeta   @relation(fields: [seoMetaId], references: [id], onDelete: Cascade)

  score       Int       // 0–100
  validatedAt DateTime  @default(now())

  issues      SeoIssue[]

  @@index([seoMetaId])
  @@map("seo_scores")
}

model SeoIssue {
  id         String        @id @default(cuid())
  seoScoreId String
  seoScore   SeoScore      @relation(fields: [seoScoreId], references: [id], onDelete: Cascade)

  type       String        // "missing-meta-description", "title-too-long"
  severity   IssueSeverity
  message    String
  penalty    Int           // points deducted from score

  @@index([seoScoreId])
  @@map("seo_issues")
}


// ============================================================
// AUTH MODULE
// ============================================================

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String?   // null for OAuth-only users
  firstName     String?
  lastName      String?
  avatarUrl     String?
  isActive      Boolean   @default(true)
  isVerified    Boolean   @default(false)
  lastLoginAt   DateTime?

  // Trash (only ADMIN/SUPER_ADMIN can restore)
  trashedAt        DateTime?
  trashedByUserId  String?

  roles            UserRole[]
  oauthAccounts    OAuthAccount[]
  refreshTokens    RefreshToken[]
  apiTokens        ApiToken[]
  agentTokens      AgentToken[]

  // Authorship trails
  auditLogs        AuditLog[]
  createdEntries   ContentEntry[]        @relation("CreatedEntries")
  updatedEntries   ContentEntry[]        @relation("UpdatedEntries")
  trashedEntries   ContentEntry[]        @relation("TrashedEntries")
  savedVersions    ContentEntryVersion[]
  redirectsCreated Redirect[]
  filesUploaded    MediaFile[]

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([email])
  @@map("users")
}

model Role {
  id          String    @id @default(cuid())
  name        String    @unique  // "super_admin", "admin", "editor", "viewer"
  displayName String
  description String?
  isSystem    Boolean   @default(false) // system roles cannot be deleted

  users       UserRole[]
  permissions RolePermission[]

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@map("roles")
}

model Permission {
  id       String @id @default(cuid())
  resource String // "content", "media", "seo", "plugin", "user", "webhook"
  action   String // "read", "create", "update", "delete", "publish", "restore"
  scope    String @default("*") // "*" = all, or specific contentType name

  roles    RolePermission[]

  @@unique([resource, action, scope])
  @@map("permissions")
}

model UserRole {
  userId     String
  roleId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  role       Role     @relation(fields: [roleId], references: [id], onDelete: Cascade)
  assignedAt DateTime @default(now())
  assignedBy String?

  @@id([userId, roleId])
  @@map("user_roles")
}

model RolePermission {
  roleId       String
  permissionId String
  role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([roleId, permissionId])
  @@map("role_permissions")
}

model OAuthAccount {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider    String   // "google", "github"
  providerId  String   // their ID on that provider
  email       String?
  accessToken String?  // encrypted
  createdAt   DateTime @default(now())

  @@unique([provider, providerId])
  @@index([userId])
  @@map("oauth_accounts")
}

model RefreshToken {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String    @unique   // store hash, never plain text
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime  @default(now())

  @@index([userId])
  @@map("refresh_tokens")
}

model ApiToken {
  id         String     @id @default(cuid())
  userId     String
  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  name       String
  tokenHash  String     @unique  // store hash, never plain text
  prefix     String              // first 8 chars shown in UI: "kast_abc1..."
  scope      TokenScope
  scopeData  Json?               // used when scope = SCOPED: { content: ['read'] }
  lastUsedAt DateTime?
  expiresAt  DateTime?
  revokedAt  DateTime?
  createdAt  DateTime   @default(now())

  @@index([userId])
  @@map("api_tokens")
}


// ============================================================
// MEDIA MODULE
// ============================================================

model MediaFolder {
  id        String        @id @default(cuid())
  name      String
  parentId  String?
  parent    MediaFolder?  @relation("FolderTree", fields: [parentId], references: [id])
  children  MediaFolder[] @relation("FolderTree")
  files     MediaFile[]

  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt

  @@map("media_folders")
}

model MediaFile {
  id            String       @id @default(cuid())
  folderId      String?
  folder        MediaFolder? @relation(fields: [folderId], references: [id])

  filename      String       // stored filename (may differ from original)
  originalName  String       // original upload filename
  mimeType      String       // "image/jpeg", "application/pdf"
  size          Int          // bytes
  url           String       // public access URL
  storageKey    String       // internal path/key in the storage provider
  provider      String       // "local", "s3", "r2", "gcs"

  // Image-specific metadata
  width         Int?
  height        Int?
  altText       String?
  isAiAltText   Boolean      @default(false)

  // AI generation
  isAiGenerated  Boolean     @default(false)
  aiGenerations  AiImageGeneration[]

  // Trash
  trashedAt        DateTime?
  trashedByUserId  String?

  uploadedById  String
  uploadedBy    User         @relation(fields: [uploadedById], references: [id])

  usages        MediaUsage[]
  seoMetaOg     SeoMeta[]   @relation("OgImage")
  seoMetaTwitter SeoMeta[]  @relation("TwitterImage")

  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  @@index([folderId])
  @@index([mimeType])
  @@index([trashedAt])
  @@map("media_files")
}

model MediaUsage {
  id        String       @id @default(cuid())
  fileId    String
  file      MediaFile    @relation(fields: [fileId], references: [id], onDelete: Cascade)
  entryId   String
  entry     ContentEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)
  fieldName String       // which field references this file

  @@unique([fileId, entryId, fieldName])
  @@index([fileId])
  @@index([entryId])
  @@map("media_usages")
}


// ============================================================
// MCP MODULE
// ============================================================

model AgentToken {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  name        String    // "Claude Agent", "Cursor Dev"
  tokenHash   String    @unique
  prefix      String    // first 8 chars for display
  scope       Json      // { content: ['read','write'], plugins: ['read'] }
  lastUsedAt  DateTime?
  revokedAt   DateTime?

  sessions    AgentSession[]

  createdAt   DateTime  @default(now())

  @@index([userId])
  @@map("agent_tokens")
}

model AgentSession {
  id           String     @id @default(cuid())
  agentTokenId String
  agentToken   AgentToken @relation(fields: [agentTokenId], references: [id], onDelete: Cascade)

  agentName    String?    // "claude-sonnet-4", "cursor"
  toolsUsed    Json       @default("[]")  // list of MCP tool names called
  startedAt    DateTime   @default(now())
  endedAt      DateTime?

  @@index([agentTokenId])
  @@map("agent_sessions")
}


// ============================================================
// I18N MODULE
// ============================================================

model Locale {
  code         String    @id  // "en", "ar", "fr-FR"
  name         String        // "English", "Arabic"
  nativeName   String        // "English", "العربية"
  direction    TextDirection @default(LTR)
  isDefault    Boolean   @default(false)
  isActive     Boolean   @default(true)
  fallbackCode String?        // if no content in this locale, fall back to here
  fallback     Locale?   @relation("LocaleFallback", fields: [fallbackCode], references: [code])
  fallbackFor  Locale[]  @relation("LocaleFallback")

  entries      ContentEntryLocale[]
  menus        Menu[]

  createdAt    DateTime  @default(now())

  @@map("locales")
}


// ============================================================
// AUDIT MODULE
// ============================================================

model AuditLog {
  id         String   @id @default(cuid())

  // Actor — either a human user or an AI agent (or system)
  userId     String?
  user       User?    @relation(fields: [userId], references: [id])
  agentTokenId String?  // AgentToken ID if done by AI agent
  agentName  String?    // "claude-sonnet-4", "cursor"
  ipAddress  String?
  userAgent  String?

  // What happened
  action     String   // "content.create", "content.publish", "user.login", "plugin.install"
  resource   String   // "ContentEntry", "User", "Plugin", "MediaFile"
  resourceId String?  // ID of the affected record

  // The diff
  before     Json?    // state before the change
  after      Json?    // state after the change
  metadata   Json?    // additional context

  // MCP dry-run flag
  isDryRun   Boolean  @default(false)

  createdAt  DateTime @default(now())

  // AuditLog is immutable — no updatedAt
  // No soft delete — audit logs are permanent

  @@index([userId])
  @@index([agentTokenId])
  @@index([resource, resourceId])
  @@index([createdAt])
  @@index([action])
  @@map("audit_logs")
}


// ============================================================
// WEBHOOK MODULE
// ============================================================

model WebhookEndpoint {
  id         String    @id @default(cuid())
  name       String
  url        String
  secretHash String    // HMAC signing secret (hashed at rest)
  isActive   Boolean   @default(true)
  events     String[]  // ["content.published", "media.uploaded", "form.submitted"]

  deliveries WebhookDelivery[]

  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  @@map("webhook_endpoints")
}

model WebhookDelivery {
  id           String          @id @default(cuid())
  endpointId   String
  endpoint     WebhookEndpoint @relation(fields: [endpointId], references: [id], onDelete: Cascade)

  event        String          // "content.published"
  payload      Json            // the exact JSON payload sent
  statusCode   Int?            // HTTP response status
  responseBody String?         // first 1000 chars of response
  attempts     Int             @default(0)
  nextRetryAt  DateTime?       // set by BullMQ backoff
  succeededAt  DateTime?
  failedAt     DateTime?

  createdAt    DateTime        @default(now())

  @@index([endpointId])
  @@index([event])
  @@index([failedAt])
  @@map("webhook_deliveries")
}


// ============================================================
// PLUGIN MODULE
// ============================================================

model Plugin {
  id             String       @id @default(cuid())
  name           String       @unique  // "@kast-cms/plugin-stripe"
  displayName    String
  version        String
  description    String?
  isActive       Boolean      @default(false)
  isSystemPlugin Boolean      @default(false)
  installedAt    DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  config         PluginConfig?

  @@map("plugins")
}

model PluginConfig {
  id       String   @id @default(cuid())
  pluginId String   @unique
  plugin   Plugin   @relation(fields: [pluginId], references: [id], onDelete: Cascade)

  // Sensitive values are encrypted at the service layer before storage
  data     Json     @default("{}")

  updatedAt DateTime @updatedAt

  @@map("plugin_configs")
}


// ============================================================
// FORM MODULE
// ============================================================

model Form {
  id           String      @id @default(cuid())
  name         String
  slug         String      @unique
  description  String?
  isActive     Boolean     @default(true)
  notifyEmail  String?     // email to notify on new submission

  // Trash
  trashedAt        DateTime?
  trashedByUserId  String?

  fields       FormField[]
  submissions  FormSubmission[]

  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  @@map("forms")
}

model FormField {
  id         String        @id @default(cuid())
  formId     String
  form       Form          @relation(fields: [formId], references: [id], onDelete: Cascade)

  name       String        // slug: "email", "message"
  label      String        // "Your Email", "Your Message"
  type       FormFieldType
  isRequired Boolean       @default(false)
  position   Int           @default(0)
  config     Json          @default("{}") // placeholder, options, validation rules, etc.

  @@unique([formId, name])
  @@index([formId])
  @@map("form_fields")
}

model FormSubmission {
  id        String   @id @default(cuid())
  formId    String
  form      Form     @relation(fields: [formId], references: [id], onDelete: Cascade)

  data      Json     // { fieldName: value, ... }
  ipAddress String?
  userAgent String?
  isRead    Boolean  @default(false)
  readAt    DateTime?

  createdAt DateTime @default(now())

  @@index([formId])
  @@index([isRead])
  @@map("form_submissions")
}


// ============================================================
// MENU / NAVIGATION MODULE
// ============================================================

model Menu {
  id         String     @id @default(cuid())
  name       String
  slug       String     @unique // "main-nav", "footer"
  localeCode String?
  locale     Locale?    @relation(fields: [localeCode], references: [code])

  items      MenuItem[]

  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt

  @@map("menus")
}

model MenuItem {
  id        String     @id @default(cuid())
  menuId    String
  menu      Menu       @relation(fields: [menuId], references: [id], onDelete: Cascade)
  parentId  String?
  parent    MenuItem?  @relation("MenuItemTree", fields: [parentId], references: [id])
  children  MenuItem[] @relation("MenuItemTree")

  label     String
  url       String?    // external URL (null if linking to a ContentEntry)
  entryId   String?    // link to an internal content entry
  target    String?    // "_blank", "_self"
  position  Int        @default(0)
  isActive  Boolean    @default(true)

  @@index([menuId])
  @@index([parentId])
  @@map("menu_items")
}


// ============================================================
// SETTINGS MODULE
// ============================================================

model GlobalSetting {
  id        String   @id @default(cuid())
  key       String   @unique  // "site.name", "seo.default-og-image-id", "auth.allow-registration"
  value     Json
  group     String            // "site", "seo", "media", "auth", "email"
  label     String?
  isPublic  Boolean  @default(false) // can be exposed via public /api/v1/settings
  updatedAt DateTime @updatedAt
  updatedBy String?

  @@index([group])
  @@map("global_settings")
}


// ============================================================
// AI MODULE
// ============================================================

model AiContentGeneration {
  id           String       @id @default(cuid())
  entryId      String?
  entry        ContentEntry? @relation(fields: [entryId], references: [id])

  prompt       String       // the prompt sent to the model
  model        String       // "claude-sonnet-4", "gpt-4o"
  provider     String       // "anthropic", "openai"
  result       String?      // the generated text result
  tokensUsed   Int?
  durationMs   Int?         // how long the generation took
  status       AiJobStatus
  errorMessage String?

  // Context
  fieldName    String?      // which field was being generated
  localeCode   String?      // which locale

  // Attribution
  triggeredBy  String?      // userId or agentTokenId
  triggerType  AiTriggerType

  createdAt    DateTime     @default(now())

  @@index([entryId])
  @@index([status])
  @@index([triggeredBy])
  @@map("ai_content_generations")
}

model AiImageGeneration {
  id           String     @id @default(cuid())
  mediaFileId  String?    // populated after the image is saved to MediaFile
  mediaFile    MediaFile? @relation(fields: [mediaFileId], references: [id])

  prompt       String
  model        String     // "dall-e-3", "stable-diffusion-xl"
  provider     String     // "openai", "stability", "replicate"
  resultUrl    String?    // temporary URL before saved to media
  status       AiJobStatus
  errorMessage String?
  durationMs   Int?

  // Attribution
  triggeredBy  String?
  triggerType  AiTriggerType

  createdAt    DateTime   @default(now())

  @@index([mediaFileId])
  @@index([status])
  @@map("ai_image_generations")
}
```

---

## 6. ER Diagram

```
ContentType ──< ContentField
ContentType ──< ContentEntry
ContentEntry ──< ContentEntryLocale >── Locale
ContentEntry ──< ContentEntryVersion
ContentEntry ──< ContentRelation >── ContentEntry
ContentEntry ──1── SeoMeta ──< SeoScore ──< SeoIssue
ContentEntry ──< MediaUsage >── MediaFile
ContentEntry ──< AiContentGeneration

User ──< UserRole >── Role
Role ──< RolePermission >── Permission
User ──< OAuthAccount
User ──< RefreshToken
User ──< ApiToken
User ──< AgentToken ──< AgentSession

MediaFile ──< MediaUsage
MediaFile ──< AiImageGeneration
MediaFolder ──< MediaFolder (self: parent/children)
MediaFolder ──< MediaFile

WebhookEndpoint ──< WebhookDelivery

Plugin ──1── PluginConfig

Form ──< FormField
Form ──< FormSubmission

Menu ──< MenuItem
MenuItem ──< MenuItem (self: parent/children)

Locale ──< Locale (self: fallback chain)
Locale ──< ContentEntryLocale
Locale ──< Menu

User ──< AuditLog
AgentToken ──< AuditLog (via agentTokenId field)

GlobalSetting (standalone)
Redirect (standalone)
```

---

## 7. Index Strategy

### High-traffic read indexes

```sql
-- Content queries (most common operation)
content_entries(content_type_id, status)
content_entry_locales(entry_id)
content_entry_locales(locale_code, slug)  -- slug lookup for routing

-- Auth (every request)
users(email)
refresh_tokens(user_id)
api_tokens(token_hash)
agent_tokens(token_hash)

-- Audit (high write volume)
audit_logs(user_id)
audit_logs(resource, resource_id)
audit_logs(created_at)
audit_logs(agent_token_id)

-- SEO
seo_scores(seo_meta_id)

-- Webhooks
webhook_deliveries(endpoint_id)
webhook_deliveries(failed_at)     -- for retry jobs

-- Media
media_files(folder_id)
media_files(mime_type)
media_files(trashed_at)          -- for trash cleanup job

-- Trash cleanup
content_entries(trashed_at)
```

### Unique constraints

```sql
content_types(name)
content_fields(content_type_id, name)
content_entry_locales(entry_id, locale_code)
content_entry_locales(locale_code, slug)
content_entry_versions(entry_id, version_number)
content_relations(from_id, to_id, field_name)
users(email)
oauth_accounts(provider, provider_id)
refresh_tokens(token_hash)
api_tokens(token_hash)
agent_tokens(token_hash)
seo_meta(entry_id)
redirects(from_path)
permissions(resource, action, scope)
plugins(name)
plugin_configs(plugin_id)
forms(slug)
form_fields(form_id, name)
menus(slug)
global_settings(key)
```

---

## 8. Key Design Decisions

### Why `cuid()` and not `uuid()`?

cuid2 is URL-safe, shorter, and collision-resistant at scale. UUIDs work too but cuid2 is better for IDs that appear in URLs (content entry IDs, media file IDs).

### Why is content `data` stored as `Json` in `ContentEntryLocale`?

Content types are user-defined. We cannot know the columns at schema design time. PostgreSQL JSONB is indexed, queryable, and production-grade. This is the same approach Strapi and Payload use.

### Why does `ContentEntryVersion` store a full snapshot?

Diffs are lossy and hard to revert from. A full JSON snapshot per version is slightly more storage but makes "revert to version 5" a simple overwrite operation. Version numbers are sequential per entry.

### Why is `AuditLog` immutable?

No `updatedAt`. No soft delete. An audit trail is only trustworthy if it cannot be modified after the fact. If an admin tries to delete an audit log, the system rejects it.

### Why store `tokenHash` and not the token itself?

API tokens, refresh tokens, and agent tokens are secrets. If the database is leaked, hashed tokens are useless to an attacker. The plain token is only shown once at creation time.

### Why does `GlobalSetting.value` use `Json`?

Settings can be strings, numbers, booleans, or arrays (e.g., allowed file types). `Json` handles all of these without per-setting schema changes.

### Why no `tenantId` in v1?

Multi-tenancy is a v3 feature. Adding `tenantId` to every table now would complicate every query and every index. The schema is designed so that `tenantId` can be added as a column later. The service layer will enforce tenant isolation when the time comes.

### Why are `Form` and `Menu` separate from `ContentType`?

Forms and menus have fundamentally different behaviors (submissions, ordering, rendering) that don't fit the generic content type model. They share the same infrastructure (trash, audit, API) but have their own tables and services.

### AI tables are v2 features but v1 schema

The `AiContentGeneration` and `AiImageGeneration` tables are created in the v1 migration but the features that populate them ship in v2. This avoids a painful migration later and lets us track AI usage from day one.

---

_Document version: 0.1_
_Last updated: April 2026_
_Models: 38 | Enums: 8 | Total tables: 40 (38 models + 2 junction tables)_
_Status: Ready for Prisma implementation_
