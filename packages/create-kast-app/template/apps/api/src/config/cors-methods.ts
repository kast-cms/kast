/**
 * The methods advertised to browsers on the CORS preflight. A verb missing here
 * makes every browser call to a route using it fail before it is sent, while
 * server-to-server callers keep working — so the gap only shows up in the admin.
 * cors-methods.spec.ts holds this to the verbs the controllers actually route.
 */
export const CORS_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const;
