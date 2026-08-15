export const MCP_TOOL_CATALOG = {
  list_content_types: { resource: 'content-types', action: 'read' },
  get_content_type: { resource: 'content-types', action: 'read' },
  create_content_type: { resource: 'content-types', action: 'create' },
  update_content_type: { resource: 'content-types', action: 'update' },
  add_content_type_field: { resource: 'content-types', action: 'create' },
  list_content_entries: { resource: 'content', action: 'read' },
  get_content_entry: { resource: 'content', action: 'read' },
  create_content_entry: { resource: 'content', action: 'create' },
  update_content_entry: { resource: 'content', action: 'update' },
  publish_content_entry: { resource: 'content', action: 'publish' },
  unpublish_content_entry: { resource: 'content', action: 'unpublish' },
  delete_content_entry: { resource: 'content', action: 'delete' },
  list_media: { resource: 'media', action: 'read' },
  get_media_file: { resource: 'media', action: 'read' },
  upload_media_from_url: { resource: 'media', action: 'create' },
  get_seo_score: { resource: 'seo', action: 'read' },
  validate_seo: { resource: 'seo', action: 'validate' },
  // Redirects live under /seo/redirects, so RBAC scopes them as `seo` — the MCP
  // entry has to name the same resource or the two models disagree.
  create_redirect: { resource: 'seo', action: 'create' },
  list_plugins: { resource: 'plugins', action: 'read' },
  enable_plugin: { resource: 'plugins', action: 'enable' },
  disable_plugin: { resource: 'plugins', action: 'disable' },
  invite_user: { resource: 'users', action: 'create' },
  get_audit_log: { resource: 'audit', action: 'read' },
} as const;

export type McpToolName = keyof typeof MCP_TOOL_CATALOG;
export const MCP_TOOL_NAMES = Object.keys(MCP_TOOL_CATALOG) as McpToolName[];

export function isMcpToolName(value: string): value is McpToolName {
  return Object.hasOwn(MCP_TOOL_CATALOG, value);
}
