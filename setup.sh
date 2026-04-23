#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Kast CMS — First Commit Setup Script
# Run this ONCE from an empty directory on your machine
# Usage: bash setup.sh
# ─────────────────────────────────────────────────────────────

set -e

echo ""
echo "  KAST CMS — Monorepo First Commit Setup"
echo "─────────────────────────────────────────"
echo ""

# ── 1. Check prerequisites ────────────────────────────────────
echo "Checking prerequisites..."

NODE_VERSION=$(node -e "process.exit(parseInt(process.version.slice(1)) < 20 ? 1 : 0)" 2>/dev/null && echo "ok" || echo "fail")
if [ "$NODE_VERSION" = "fail" ]; then
  echo "ERROR: Node.js >= 20 required. Current: $(node --version)"
  exit 1
fi
echo "  Node.js $(node --version) ✓"

if ! command -v pnpm &> /dev/null; then
  echo "ERROR: pnpm not found. Install with: npm install -g pnpm"
  exit 1
fi
echo "  pnpm $(pnpm --version) ✓"

if ! command -v git &> /dev/null; then
  echo "ERROR: git not found."
  exit 1
fi
echo "  git $(git --version | awk '{print $3}') ✓"

echo ""

# ── 2. Initialize git ─────────────────────────────────────────
echo "Initializing git..."
git init
git checkout -b main
echo ""

# ── 3. Create placeholder directories ────────────────────────
echo "Creating monorepo structure..."
mkdir -p apps packages plugins docs
touch apps/.gitkeep packages/.gitkeep plugins/.gitkeep docs/.gitkeep
echo ""

# ── 4. Install dependencies ───────────────────────────────────
echo "Installing root dependencies..."
pnpm install
echo ""

# ── 5. Initialize Husky ───────────────────────────────────────
echo "Setting up Husky git hooks..."
pnpm exec husky
chmod +x .husky/pre-commit .husky/commit-msg .husky/pre-push
echo ""

# ── 6. Add remote ─────────────────────────────────────────────
echo "Adding GitHub remote..."
git remote add origin https://github.com/kast-cms/kast.git
echo ""

# ── 7. First commit ───────────────────────────────────────────
echo "Creating first commit..."
git add .
# Bypass hooks for the initial commit (hooks need the deps to be installed first)
HUSKY=0 git commit -m "chore(config): initialize kast monorepo

- pnpm workspace + Turborepo
- TypeScript strict base config
- ESLint flat config v9
- Prettier with organize-imports
- Commitlint with Kast scopes
- Husky pre-commit, commit-msg, pre-push hooks
- GitHub Actions CI workflow
- MIT license, README, CONTRIBUTING"
echo ""

# ── 8. Push ───────────────────────────────────────────────────
echo "Pushing to GitHub..."
git push -u origin main
echo ""

echo "─────────────────────────────────────────"
echo ""
echo "  First commit pushed to kast-cms/kast"
echo ""
echo "  Next steps:"
echo "  1. Set branch protection rules on main and develop"
echo "  2. Add NPM_TOKEN and DOCKER_HUB_TOKEN to GitHub Secrets"
echo "  3. Create the develop branch: git checkout -b develop && git push origin develop"
echo "  4. Create GitHub issue labels (see CONTRIBUTING.md)"
echo ""
echo "  Then tell Claude — ready for Phase 1 scaffold!"
echo ""
