import { checkRedirectTarget } from './seo-settings';

export interface RedirectImportRow {
  fromPath: string;
  toPath: string;
  type: 'PERMANENT' | 'TEMPORARY';
  isActive: boolean;
}

type RedirectRowParse = { ok: true; value: RedirectImportRow } | { ok: false; reason: string };

const FALSEY = new Set(['false', '0', 'no']);

function parseRedirectRow(cols: string[], allowedHosts: string[]): RedirectRowParse {
  const fromPath = (cols[0] ?? '').trim();
  const toPath = (cols[1] ?? '').trim();
  const typeRaw = (cols[2] ?? 'PERMANENT').trim().toUpperCase();

  if (!fromPath || !toPath) return { ok: false, reason: 'Missing fromPath or toPath' };
  if (typeRaw !== 'PERMANENT' && typeRaw !== 'TEMPORARY') {
    return { ok: false, reason: `Invalid type "${typeRaw}"` };
  }
  const target = checkRedirectTarget(toPath, allowedHosts);
  if (!target.ok) return { ok: false, reason: target.reason };
  const isActive = !FALSEY.has((cols[3] ?? 'true').trim().toLowerCase());
  return { ok: true, value: { fromPath, toPath, type: typeRaw, isActive } };
}

export function parseRedirectRows(
  rows: string[][],
  allowedHosts: string[],
): {
  valid: RedirectImportRow[];
  errors: { row: number; reason: string }[];
  skipped: number;
} {
  // Detect and drop a header row if present.
  const first = rows[0]?.map((c) => c.trim().toLowerCase()) ?? [];
  const startIdx = first[0] === 'frompath' || first.includes('frompath') ? 1 : 0;

  const valid: RedirectImportRow[] = [];
  const errors: { row: number; reason: string }[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (let i = startIdx; i < rows.length; i++) {
    const rowNum = i + 1;
    const parsed = parseRedirectRow(rows[i] ?? [], allowedHosts);
    if (!parsed.ok) {
      errors.push({ row: rowNum, reason: parsed.reason });
      continue;
    }
    if (seen.has(parsed.value.fromPath)) {
      skipped++;
      errors.push({ row: rowNum, reason: 'Duplicate fromPath' });
      continue;
    }
    seen.add(parsed.value.fromPath);
    valid.push(parsed.value);
  }
  return { valid, errors, skipped };
}
