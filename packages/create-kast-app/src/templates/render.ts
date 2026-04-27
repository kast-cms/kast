export const RENDER_TEMPLATE = `# Render deployment blueprint
# https://render.com/docs/blueprint-spec

services:
  - type: web
    name: {{projectName}}-api
    env: docker
    dockerfilePath: apps/api/Dockerfile
    plan: starter
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: {{projectName}}-db
          property: connectionString
      - key: REDIS_HOST
        fromService:
          name: {{projectName}}-redis
          type: redis
          property: host
      - key: REDIS_PORT
        fromService:
          name: {{projectName}}-redis
          type: redis
          property: port
      - key: JWT_SECRET
        generateValue: true
      - key: CORS_ORIGINS
        value: https://{{projectName}}.onrender.com

databases:
  - name: {{projectName}}-db
    plan: starter
    databaseName: kast_db
    user: kast

  - name: {{projectName}}-redis
    type: redis
    plan: starter
`;
