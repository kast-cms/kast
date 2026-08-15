/** Permissions a plugin may request in its manifest. */
export enum PluginPermission {
  CONTENT_READ = 'content:read',
  CONTENT_WRITE = 'content:write',
  SETTINGS_READ = 'settings:read',
  SETTINGS_WRITE = 'settings:write',
  MEDIA_READ = 'media:read',
  MEDIA_WRITE = 'media:write',
}

/** Lifecycle hooks delivered to plugins via the Kast event bus. */
export enum PluginHook {
  CONTENT_CREATED = 'content.created',
  CONTENT_UPDATED = 'content.updated',
  CONTENT_DELETED = 'content.deleted',
  CONTENT_PUBLISHED = 'content.published',
  CONTENT_TRASHED = 'content.trashed',
  CONTENT_UNPUBLISHED = 'content.unpublished',
  MEDIA_UPLOADED = 'media.uploaded',
  MEDIA_DELETED = 'media.deleted',
  STRIPE_EVENT = 'stripe.event',
}

export interface PluginEmailMessage {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
}

export interface PluginEmailTransport {
  readonly provider: string;
  send(message: PluginEmailMessage): Promise<void>;
}

export interface PluginStorageAdapter {
  readonly provider: string;
  upload(
    key: string,
    body: Uint8Array,
    mimeType: string,
  ): Promise<{ url: string; storageKey: string }>;
  read(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
}

export interface PluginErrorReporter {
  readonly provider: string;
  captureException(error: unknown, context?: Record<string, unknown>): void;
}

/**
 * Context object passed to a plugin's onLoad method.
 * Provides access to the parts of Kast the plugin is permitted to use.
 */
export interface KastPluginContext {
  /**
   * Subscribe to a Kast lifecycle hook.
   * The handler fires each time the named event is emitted.
   */
  on(event: PluginHook, handler: (payload: unknown) => void | Promise<void>): void;

  /**
   * Retrieve persisted configuration for this plugin.
   * Returns the `data` JSON blob stored in `PluginConfig`, or `{}` if none.
   */
  getConfig(): Promise<Record<string, unknown>>;

  /**
   * Persist configuration for this plugin.
   */
  setConfig(data: Record<string, unknown>): Promise<void>;

  /** Register an outbound email transport until this plugin is disabled. */
  registerEmailTransport(transport: PluginEmailTransport): void;

  /** Register a media storage adapter until this plugin is disabled. */
  registerStorageAdapter(adapter: PluginStorageAdapter): void;

  /** Register a handled-error reporter until this plugin is disabled. */
  registerErrorReporter(reporter: PluginErrorReporter): void;

  /** The plugin's name from its manifest. */
  readonly pluginName: string;
}

/** Interface every Kast plugin must implement. */
export interface IKastPlugin {
  /**
   * Called once at application startup after all core modules are ready.
   * Plugins should subscribe to hooks and perform initialisation here.
   */
  onLoad(ctx: KastPluginContext): Promise<void>;

  /** Called before a live disable or uninstall. */
  onUnload?(): Promise<void>;
}
