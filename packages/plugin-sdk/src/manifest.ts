import { z } from 'zod';
import { PluginHook, PluginPermission } from './types.js';

const adminPageSchema = z.object({
  label: z.string().min(1),
  path: z.string().min(1),
  icon: z.string().optional(),
});

/**
 * Zod schema for the `kast-plugin.json` manifest file.
 * Every plugin must include this file in its root directory.
 */
export const pluginManifestSchema = z.object({
  /** NPM-style package name, e.g. `kast-plugin-meilisearch` */
  name: z
    .string()
    .min(1)
    .regex(/^[a-z0-9@/_-]+$/, 'must be a valid package name'),
  /** Semver version string */
  version: z.string().regex(/^\d+\.\d+\.\d+/, 'must be semver'),
  /** Human-readable display name shown in the admin panel */
  displayName: z.string().min(1),
  /** Optional short description */
  description: z.string().optional(),
  /** Permissions the plugin requires — must all be in the allowed set */
  permissions: z.array(z.nativeEnum(PluginPermission)).default([]),
  /** Lifecycle hooks the plugin subscribes to */
  hooks: z.array(z.nativeEnum(PluginHook)).default([]),
  /** Admin pages the plugin contributes (Phase 3 Module Federation) */
  adminPages: z.array(adminPageSchema).default([]),
  /** Environment variable names the plugin reads */
  env: z.array(z.string()).default([]),
});

export type PluginManifest = z.infer<typeof pluginManifestSchema>;
