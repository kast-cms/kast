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
  MEDIA_UPLOADED = 'media.uploaded',
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
}

/** Interface every Kast plugin must implement. */
export interface IKastPlugin {
  /**
   * Called once at application startup after all core modules are ready.
   * Plugins should subscribe to hooks and perform initialisation here.
   */
  onLoad(ctx: KastPluginContext): Promise<void>;
}
