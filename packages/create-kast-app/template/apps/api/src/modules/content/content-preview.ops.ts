import type { ContentTypeWithFields } from '../content-types/content-types.repository';
import type { SeoService } from '../seo/seo.service';
import type { EntryWithLocale } from './content.repository';
import type { ContentWriteGate } from './validation/content-write.gate';

/**
 * Dry-run previews for the MCP write tools.
 *
 * Each one runs the same checks its real counterpart runs and performs no
 * write, so an agent that shows an operator "this would publish" cannot then be
 * refused by a gate the preview skipped. They take the already-resolved entry
 * so the caller keeps ownership of the type-binding lookup.
 */

export interface PublishPreview {
  wouldPublish: boolean;
  seoScore: number;
  warnings: unknown[];
  errors: unknown[];
}

export async function previewEntryPublish(
  gate: ContentWriteGate,
  seoService: SeoService,
  ct: ContentTypeWithFields,
  entry: EntryWithLocale,
  force: boolean,
): Promise<PublishPreview> {
  await gate.assertStoredPublishable(ct, entry);
  const validation = await seoService.validateNow(entry.id);
  return {
    wouldPublish: validation.errors.length === 0 && (force || validation.warnings.length === 0),
    seoScore: validation.score,
    warnings: validation.warnings,
    errors: validation.errors,
  };
}

export function previewEntryTrash(entry: EntryWithLocale): { wouldTrash: true; status: string } {
  return { wouldTrash: true, status: entry.status };
}

/**
 * Unpublishing a draft succeeds but changes nothing, so the preview reports
 * whether the entry is actually published rather than a bare success.
 */
export function previewEntryUnpublish(entry: EntryWithLocale): {
  wouldUnpublish: boolean;
  status: string;
} {
  return { wouldUnpublish: entry.status === 'PUBLISHED', status: entry.status };
}
