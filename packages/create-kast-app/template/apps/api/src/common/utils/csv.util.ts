/**
 * Minimal RFC-4180-ish CSV helpers. Sufficient for redirect import/export where
 * values are simple paths; supports quoted fields containing commas, quotes
 * (escaped as ""), and newlines.
 */
import { BadRequestException } from '@nestjs/common';

/** Parses stop here: past this many characters the import is a DoS vector, not data. */
export const MAX_CSV_INPUT_CHARS = 1_000_000;

function assertWithinCsvLimits(input: string): void {
  if (input.length > MAX_CSV_INPUT_CHARS) {
    throw new BadRequestException(`CSV input exceeds ${MAX_CSV_INPUT_CHARS} characters`);
  }
}

export function parseCsv(input: string): string[][] {
  assertWithinCsvLimits(input);
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  const text = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // Constant bound on the scan loop — the guard above already rejected anything
  // longer, and normalization can only shrink the string, but neither fact is
  // visible to the loop itself.
  const chars = Math.min(text.length, MAX_CSV_INPUT_CHARS);

  for (let i = 0; i < chars; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  // Flush trailing field/row if the file did not end with a newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

export function toCsvRow(values: (string | number | boolean | null | undefined)[]): string {
  return values
    .map((v) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    })
    .join(',');
}
