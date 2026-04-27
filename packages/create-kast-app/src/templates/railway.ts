export const RAILWAY_TEMPLATE = `# Railway deployment configuration
# https://docs.railway.app/reference/config-as-code

[build]
builder = "DOCKERFILE"
dockerfilePath = "apps/api/Dockerfile"

[deploy]
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3

[[services]]
name = "api"
source = "."

[[services]]
name = "postgres"
image = "postgres:16-alpine"

[[services]]
name = "redis"
image = "redis:7-alpine"
`;
