import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import type { PackageManager } from './types.js';

/**
 * Internal workspace dependency specifier for the chosen package manager.
 * pnpm (v10+) only links local workspace packages via the `workspace:` protocol,
 * while npm and Yarn Classic reject it — they resolve workspaces from a plain range.
 */
export function internalDepSpec(pm: PackageManager, pmVersion: string): string {
  if (pm === 'pnpm' || pm === 'bun') return 'workspace:*';
  if (pm === 'yarn') {
    const major = Number.parseInt(pmVersion.split('.')[0] ?? '1', 10);
    return major >= 2 ? 'workspace:*' : '*';
  }
  return '*'; // npm
}

/**
 * Build the command that runs a script in a specific workspace package.
 * Each package manager has its own filtering syntax.
 */
export function wsRun(pm: PackageManager, pkg: string, script: string): string {
  switch (pm) {
    case 'npm':
      return `npm run ${script} --workspace ${pkg}`;
    case 'yarn':
      return `yarn workspace ${pkg} run ${script}`;
    case 'bun':
      return `bun run --filter ${pkg} ${script}`;
    case 'pnpm':
    default:
      return `pnpm --filter ${pkg} run ${script}`;
  }
}

const WORKSPACE_PKG_DIRS = ['apps', 'packages', 'plugins'];
const DEP_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

/** Replace any `workspace:` range with `spec` across all dependency fields. */
function rewriteManifestDeps(pkg: Record<string, unknown>, spec: string): boolean {
  let changed = false;
  for (const field of DEP_FIELDS) {
    const deps = pkg[field] as Record<string, string> | undefined;
    if (!deps) continue;
    for (const [name, version] of Object.entries(deps)) {
      if (typeof version === 'string' && version.startsWith('workspace:')) {
        deps[name] = spec;
        changed = true;
      }
    }
  }
  return changed;
}

/** Rewrite a single package.json (no-op if it is missing or unchanged). */
async function rewriteManifest(pkgPath: string, spec: string): Promise<void> {
  let raw: string;
  try {
    raw = await readFile(pkgPath, 'utf-8');
  } catch {
    return;
  }
  const pkg = JSON.parse(raw) as Record<string, unknown>;
  if (rewriteManifestDeps(pkg, spec)) {
    await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf-8');
  }
}

/**
 * Rewrite `workspace:*` (and other `workspace:` ranges) in every workspace
 * package manifest to a specifier the chosen package manager understands.
 * Only needed for managers that don't support the `workspace:` protocol.
 */
export async function rewriteWorkspaceProtocol(targetDir: string, spec: string): Promise<void> {
  for (const dir of WORKSPACE_PKG_DIRS) {
    let entries: string[];
    try {
      entries = await readdir(join(targetDir, dir));
    } catch {
      continue;
    }
    for (const entry of entries) {
      await rewriteManifest(join(targetDir, dir, entry, 'package.json'), spec);
    }
  }
}
