#!/usr/bin/env bash
#
# Drives a generated project through its entire first run: install, Prisma
# generate, migrate, build, boot, create the first owner, model content, publish
# an entry, and read it back through the public delivery API.
#
# The other CLI tests assert file presence and string content. That is what let
# CLI-A ship — the CLI offered a storage provider the API's env schema rejects,
# so every generated project crashed on its first `pnpm dev` and no test noticed.
# This is the test that notices.
#
# Slow by nature (a full install and build of the generated monorepo), so CI runs
# it nightly rather than per-PR. Run it locally with Postgres and Redis reachable:
#
#   pnpm --filter create-kast-app build
#   DATABASE_URL=postgresql://kast:kast@localhost:5432/kast_scaffold \
#   REDIS_HOST=localhost REDIS_PORT=6379 \
#     packages/create-kast-app/test/scaffold-boot.sh
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CLI_BIN="$REPO_ROOT/packages/create-kast-app/dist/index.js"
PROJECT_NAME="kast-boot-check"
API_PORT="${API_PORT:-3210}"
API_URL="http://127.0.0.1:${API_PORT}/api/v1"

: "${DATABASE_URL:?Set DATABASE_URL to a database this script may migrate}"
export REDIS_HOST="${REDIS_HOST:-127.0.0.1}"
export REDIS_PORT="${REDIS_PORT:-6379}"
# Exported rather than written into .env: @nestjs/config and dotenv both leave an
# already-set process variable alone, so these win over whatever the scaffolder
# generated for a local docker-compose stack.
export DATABASE_URL
export PORT="$API_PORT"
export NODE_ENV=test
export JWT_SECRET="${JWT_SECRET:-nightly-scaffold-jwt-secret-at-least-32-chars}"
export KAST_SECRET_ENCRYPTION_KEY="${KAST_SECRET_ENCRYPTION_KEY:-nightly-scaffold-encryption-key-at-least-32}"

WORK_DIR="$(mktemp -d)"
PROJECT_DIR="$WORK_DIR/$PROJECT_NAME"
API_LOG="$WORK_DIR/api.log"
API_PID=""

cleanup() {
  local status=$?
  if [ -n "$API_PID" ] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi
  if [ "$status" -ne 0 ] && [ -f "$API_LOG" ]; then
    echo "::group::API log"
    tail -n 200 "$API_LOG"
    echo "::endgroup::"
  fi
  rm -rf "$WORK_DIR"
  exit "$status"
}
trap cleanup EXIT

step() { echo; echo "─── $* ───"; }

# `jq -e` fails the script on a null/false result, so each assertion is the
# extraction and the check at once.
api() {
  local method="$1" path="$2" body="${3:-}" auth="${4:-}"
  local args=(-sS -X "$method" "$API_URL$path" -H 'Content-Type: application/json')
  [ -n "$auth" ] && args+=(-H "Authorization: Bearer $auth")
  [ -n "$body" ] && args+=(-d "$body")
  curl "${args[@]}"
}

step "Generating $PROJECT_NAME"
# The CLI resolves the project directory against its own cwd, so generate from
# the scratch directory rather than wherever this script was invoked.
(cd "$WORK_DIR" && node "$CLI_BIN" "$PROJECT_NAME" --skip-interactive --skip-install >/dev/null)
cd "$PROJECT_DIR"

step "Installing dependencies"
pnpm install --no-frozen-lockfile

step "Generating the Prisma client"
pnpm --filter @kast-cms/api exec prisma generate

step "Applying migrations"
pnpm --filter @kast-cms/api exec prisma migrate deploy

step "Seeding reference data"
# The generated README's step 3. Creates locales, roles and settings — and no user
# accounts, which is what makes the setup call below the first-owner path.
pnpm db:seed

step "Building the API"
# Through turbo, so the workspace packages the API imports — plugin-sdk above all —
# are built first. `--filter @kast-cms/api` alone skips them, and the API then fails
# to resolve their type declarations.
pnpm build --filter @kast-cms/api...

step "Booting the API"
pnpm --filter @kast-cms/api exec node dist/main.js >"$API_LOG" 2>&1 &
API_PID=$!
for attempt in $(seq 1 60); do
  if curl -fsS "$API_URL/health" >/dev/null 2>&1; then break; fi
  if ! kill -0 "$API_PID" 2>/dev/null; then echo "API exited during startup"; exit 1; fi
  if [ "$attempt" = 60 ]; then echo "API never became healthy"; exit 1; fi
  sleep 2
done
curl -fsS "$API_URL/health/ready" | jq -e '.status == "ok"' >/dev/null
echo "API is healthy"

step "Creating the first owner"
api POST /auth/setup '{
  "email": "owner@kast-boot-check.local",
  "password": "BootCheck1234!",
  "firstName": "Boot",
  "lastName": "Check"
}' | jq -e '.data.email == "owner@kast-boot-check.local"' >/dev/null

TOKEN=$(api POST /auth/login '{
  "email": "owner@kast-boot-check.local",
  "password": "BootCheck1234!"
}' | jq -re '.data.accessToken')
echo "Owner created and authenticated"

step "Modelling content"
# A type with no rich-text field: the SEO gate defaults to advisory for those, so
# publishing exercises the pipeline rather than the gate's failure path.
api POST /content-types '{
  "name": "boot-note",
  "displayName": "Boot Note",
  "isPubliclyDiscoverable": true
}' "$TOKEN" | jq -e '.data.name == "boot-note"' >/dev/null

api POST /content-types/boot-note/fields '{
  "name": "title",
  "displayName": "Title",
  "type": "TEXT",
  "isRequired": true
}' "$TOKEN" | jq -e '.data.name == "title"' >/dev/null

step "Publishing an entry"
ENTRY_ID=$(api POST /content-types/boot-note/entries '{
  "locale": "en",
  "slug": "hello-from-the-scaffold",
  "data": { "title": "Hello from the scaffold" }
}' "$TOKEN" | jq -re '.data.id')

api POST "/content-types/boot-note/entries/$ENTRY_ID/publish" '{"force": true}' "$TOKEN" \
  | jq -e '.data.status == "PUBLISHED"' >/dev/null
echo "Entry $ENTRY_ID published"

step "Reading it back through the delivery API"
# Anonymous: no Authorization header. This is the contract a generated front end
# depends on, and the one that proves the whole stack is wired end to end.
# `locale` is required by contract, not optional with a default — the delivery
# routes reject a request without it rather than guessing.
curl -fsS "$API_URL/delivery/content/boot-note/hello-from-the-scaffold?locale=en" \
  | jq -e '.data.slug == "hello-from-the-scaffold"' >/dev/null

curl -fsS "$API_URL/delivery/content/boot-note?locale=en" | jq -e '.data | length == 1' >/dev/null

step "Checking the anonymous boundary still holds"
status=$(curl -sS -o /dev/null -w '%{http_code}' "$API_URL/content-types")
if [ "$status" != "401" ]; then
  echo "Expected 401 from the management API without a token, got $status"
  exit 1
fi

echo
echo "✓ Generated project installs, migrates, boots, authenticates, publishes and delivers"
