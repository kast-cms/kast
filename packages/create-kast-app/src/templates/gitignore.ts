// Static template — no Handlebars interpolation needed.
export const GITIGNORE_TEMPLATE = `# Environment
.env
.env.local
.env.*.local

# Node
node_modules/
dist/
.turbo/

# Next.js
.next/
out/

# Logs
*.log
logs/

# OS
.DS_Store
Thumbs.db

# Docker volumes (local dev)
postgres_data/
redis_data/
uploads/
`;
