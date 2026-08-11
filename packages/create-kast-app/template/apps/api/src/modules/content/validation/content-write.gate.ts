import { Injectable } from '@nestjs/common';
import type { ContentTypeWithFields } from '../../content-types/content-types.repository';
import type { EntryWithLocale, VersionWithAuthor } from '../content.repository';
import { ContentSchemaValidator } from './content-schema.validator';
import {
  ContentSchemaStateException,
  ContentValidationException,
} from './content-validation.exception';
import type {
  FieldIssue,
  UniqueCheck,
  ValidateOptions,
  ValidationMode,
  ValidationResult,
} from './content-validation.types';

interface LocalePayload {
  localeCode: string;
  data: Record<string, unknown>;
}

/** Options for a write-free validation run (MCP dry runs). */
export interface DryRunValidateOptions {
  locale?: string;
  mode?: ValidationMode;
  applyDefaults?: boolean;
}

function asData(value: unknown): Record<string, unknown> {
  return (value ?? {}) as Record<string, unknown>;
}

/**
 * Turns validation results into the HTTP outcome each write path needs: a payload
 * the caller sent is a 400, whereas already-stored content that cannot make a
 * transition is a 422.
 */
@Injectable()
export class ContentWriteGate {
  constructor(private readonly validator: ContentSchemaValidator) {}

  /**
   * Validates a payload on its own, with no entry and no write. Used by MCP
   * dry runs, which must reject exactly what the real write would reject.
   */
  async validateStandalone(
    ct: ContentTypeWithFields,
    data: Record<string, unknown>,
    options: DryRunValidateOptions = {},
  ): Promise<Record<string, unknown>> {
    const result = await this.validatePayload(ct, data, {
      mode: options.mode ?? 'draft',
      localeCode: options.locale ?? 'en',
      applyDefaults: options.applyDefaults ?? true,
    });
    return result.data;
  }

  async validatePayload(
    ct: ContentTypeWithFields,
    data: Record<string, unknown>,
    options: ValidateOptions,
  ): Promise<ValidationResult> {
    const result = await this.validator.validate(ct, data, options);
    if (result.issues.length > 0) throw new ContentValidationException(ct.name, result.issues);
    return result;
  }

  /** Re-validates what is already stored and refuses the transition if it fails. */
  async assertStoredPublishable(ct: ContentTypeWithFields, entry: EntryWithLocale): Promise<void> {
    const issues = await this.collectIssues(ct, this.publishTargets(entry), 'publish');
    if (issues.length > 0) {
      throw new ContentSchemaStateException(ct.name, 'CONTENT_SCHEMA_INVALID', issues);
    }
  }

  /**
   * Refuses to restore a snapshot taken before the schema moved. `mode` comes from
   * the status the entry is stored in: reverting live content is a publish.
   */
  async validateVersionSnapshot(
    ct: ContentTypeWithFields,
    version: VersionWithAuthor,
    primaryLocale: string,
    mode: ValidationMode = 'draft',
  ): Promise<UniqueCheck[]> {
    const targets = this.versionTargets(version, primaryLocale);
    const issues: FieldIssue[] = [];
    const uniqueChecks: UniqueCheck[] = [];
    for (const target of targets) {
      const result = await this.validator.validate(ct, target.data, {
        mode,
        localeCode: target.localeCode,
        // A snapshot is judged against the current schema — a key that is no longer
        // a field still makes it incompatible — but a value a snapshot already held
        // for a now-hidden field is not a write.
        previousData: target.data,
      });
      issues.push(...result.issues);
      uniqueChecks.push(...result.uniqueChecks);
    }
    if (issues.length > 0) {
      throw new ContentSchemaStateException(ct.name, 'VERSION_INCOMPATIBLE_WITH_SCHEMA', issues);
    }
    return uniqueChecks;
  }

  private async collectIssues(
    ct: ContentTypeWithFields,
    targets: LocalePayload[],
    mode: ValidationMode,
  ): Promise<FieldIssue[]> {
    const issues: FieldIssue[] = [];
    for (const target of targets) {
      const result = await this.validator.validate(ct, target.data, {
        mode,
        localeCode: target.localeCode,
        // Stored data is validated against itself: a field that was hidden or
        // dropped from the schema after it was written is not a write to reject,
        // otherwise editing the schema would brick every entry that has one.
        source: 'stored',
        previousData: target.data,
      });
      issues.push(...result.issues);
    }
    return issues;
  }

  /**
   * Locales seeded as empty placeholders on a localized type are skipped unless
   * they are all the entry has.
   */
  private publishTargets(entry: EntryWithLocale): LocalePayload[] {
    const populated = entry.locales.filter((l) => Object.keys(asData(l.data)).length > 0);
    const candidates = populated.length > 0 ? populated : entry.locales.slice(0, 1);
    if (candidates.length === 0) return [{ localeCode: 'en', data: {} }];
    return candidates.map((l) => ({ localeCode: l.localeCode, data: asData(l.data) }));
  }

  private versionTargets(version: VersionWithAuthor, primaryLocale: string): LocalePayload[] {
    const raw = version.localesData;
    const targets: LocalePayload[] = [];
    if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const [localeCode, payload] of Object.entries(raw as Record<string, unknown>)) {
        if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) continue;
        targets.push({ localeCode, data: asData((payload as { data?: unknown }).data) });
      }
    }
    if (targets.length > 0) return targets;
    return [{ localeCode: primaryLocale, data: asData(version.data) }];
  }
}
