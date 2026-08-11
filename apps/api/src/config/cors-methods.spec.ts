import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { CORS_METHODS } from './cors-methods';

const SRC = join(__dirname, '..');
const ROUTE_DECORATOR = /@(Get|Post|Put|Patch|Delete|Head|Options|All)\s*\(/g;

function controllerFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) controllerFiles(full, out);
    else if (entry.endsWith('.controller.ts')) out.push(full);
  }
  return out;
}

describe('CORS methods', () => {
  it('advertises every verb the controllers actually route', () => {
    const files = controllerFiles(SRC);
    expect(files.length).toBeGreaterThan(0);

    const routed = new Map<string, string[]>();
    for (const file of files) {
      const source = readFileSync(file, 'utf-8');
      for (const match of source.matchAll(ROUTE_DECORATOR)) {
        const decorator = match[1];
        if (decorator === undefined) continue;
        const verb = decorator.toUpperCase();
        routed.set(verb, [...(routed.get(verb) ?? []), file.slice(SRC.length + 1)]);
      }
    }

    const allowed = new Set<string>(CORS_METHODS);
    // @All() answers every verb, so it cannot be checked against a fixed list.
    const missing = [...routed.entries()].filter(([verb]) => verb !== 'ALL' && !allowed.has(verb));

    expect(missing.map(([verb, where]) => `${verb} (${where[0]})`)).toEqual([]);
  });

  it('includes OPTIONS so the preflight itself is answerable', () => {
    expect(CORS_METHODS).toContain('OPTIONS');
  });
});
