/**
 * Security pins for transitive dependencies, mirrored verbatim from the Kast
 * monorepo root `package.json` → `pnpm.overrides`. The monorepo maintains that
 * list in response to Dependabot advisories; generated projects would otherwise
 * install the vulnerable ranges until their own Dependabot caught up, so the
 * scaffolder bakes the pins into every project it creates.
 *
 * Where they land depends on the pinned pnpm major, mirroring how build
 * permissions are already emitted:
 *
 *   pnpm  <10   root package.json  `pnpm.overrides`
 *   pnpm >=10   pnpm-workspace.yaml  `overrides:`
 *
 * test/template-parity.test.mjs fails when this list drifts from the monorepo,
 * the same way it fails when a template tree drifts from its source. Update the
 * monorepo list first, then copy it here.
 */
import overrides from './security-overrides.json' with { type: 'json' };

export const SECURITY_OVERRIDES: Readonly<Record<string, string>> = overrides;

/** Entries for a root package.json `pnpm.overrides` block at `indent`. */
export function jsonOverridesEntries(indent: string): string {
  return Object.entries(SECURITY_OVERRIDES)
    .map(([name, version]) => `${indent}${JSON.stringify(name)}: ${JSON.stringify(version)}`)
    .join(',\n');
}

/**
 * Mapping lines for a pnpm-workspace.yaml `overrides:` block. Keys are quoted
 * because selectors contain `@`, spaces and comparators (`yaml@>=2.0.0 <2.8.3`).
 */
export function yamlOverridesEntries(indent = '  '): string {
  return Object.entries(SECURITY_OVERRIDES)
    .map(([name, version]) => `${indent}${JSON.stringify(name)}: ${version}`)
    .join('\n');
}
