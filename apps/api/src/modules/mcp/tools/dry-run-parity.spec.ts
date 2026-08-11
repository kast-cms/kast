jest.mock('isomorphic-dompurify', () => {
  const sanitize = (html: string): string => html;
  return { default: { sanitize }, sanitize };
});

import type { EventEmitter2 } from '@nestjs/event-emitter';
import { type ContentStatus, ContentFieldType } from '@prisma/client';
import type { Queue } from 'bullmq';
import type { AuthUser } from '../../../common/types/auth.types';
import type { ContentTypesService } from '../../content-types/content-types.service';
import type { ContentRepository, EntryWithLocale } from '../../content/content.repository';
import { ContentService } from '../../content/content.service';
import { clearSchemaCache } from '../../content/validation/content-schema.compiler';
import { ContentSchemaValidator } from '../../content/validation/content-schema.validator';
import type { ContentValidationRepository } from '../../content/validation/content-validation.repository';
import { ContentWriteGate } from '../../content/validation/content-write.gate';
import { buildField, buildType } from '../../content/validation/test-fixtures';
import type { SeoService } from '../../seo/seo.service';
import type { ToolContext } from '../types/mcp.types';
import { McpContentEntryTools } from './content-entry.tools';

const CT = buildType(
  [
    buildField({ id: 'f-title', name: 'title', type: ContentFieldType.TEXT, isRequired: true }),
    buildField({ id: 'f-body', name: 'body', type: ContentFieldType.TEXT, isRequired: false }),
  ],
  { id: 'ct1', name: 'blog-post' },
);

function entryWithStatus(status: string): EntryWithLocale {
  return {
    id: 'e1',
    contentTypeId: 'ct1',
    status,
    publishedAt: new Date(),
    scheduledAt: null,
    trashedAt: null,
    createdById: 'author',
    createdAt: new Date(),
    updatedAt: new Date(),
    locales: [
      {
        id: 'l1',
        entryId: 'e1',
        localeCode: 'en',
        slug: 'hello',
        data: { title: 'Hello', body: 'hi' },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  } as unknown as EntryWithLocale;
}

const USER = { id: 'u1', email: 'a@b.c', roles: ['editor'] } as AuthUser;

/** Data-only write that blanks the required `title`. No `status` in args. */
const ARGS = {
  typeSlug: 'blog-post',
  entryId: 'e1',
  data: { title: '', body: 'still here' },
};

interface Harness {
  tools: McpContentEntryTools;
  update: jest.Mock;
}

function harness(status: string): Harness {
  const update = jest.fn().mockResolvedValue(entryWithStatus(status));
  const repo = {
    findByIdForType: jest.fn().mockResolvedValue(entryWithStatus(status)),
    createVersion: jest.fn().mockResolvedValue(undefined),
    update,
    updateStatus: jest.fn().mockResolvedValue(true),
  };
  const validator = new ContentSchemaValidator({
    findLiveMedia: jest.fn().mockResolvedValue(new Map()),
    findLiveEntryTypes: jest.fn().mockResolvedValue(new Map()),
    findContentTypeIdsByName: jest.fn().mockResolvedValue(new Map()),
  } as unknown as ContentValidationRepository);
  const gate = new ContentWriteGate(validator);
  const contentTypes = {
    findByName: jest.fn().mockResolvedValue(CT),
  } as unknown as ContentTypesService;
  const service = new ContentService(
    repo as unknown as ContentRepository,
    contentTypes,
    {
      validateNow: jest
        .fn()
        .mockResolvedValue({ score: 100, issues: [], errors: [], warnings: [] }),
    } as unknown as SeoService,
    { add: jest.fn(), getJob: jest.fn() } as unknown as Queue,
    { emit: jest.fn() } as unknown as EventEmitter2,
    gate,
  );
  return { tools: new McpContentEntryTools(service, contentTypes, gate), update };
}

beforeEach(() => {
  clearSchemaCache();
});

describe.each<ContentStatus>(['PUBLISHED', 'SCHEDULED'])(
  'MCP dry run vs real write on a %s entry',
  (status) => {
    it('the dry run rejects the payload the real write rejects', async () => {
      const { tools } = harness(status);
      await expect(
        tools.updateContentEntry(ARGS, USER, { dryRun: true } as ToolContext),
      ).rejects.toThrow(/title is required/);
    });

    it('the identical real write is rejected', async () => {
      const { tools, update } = harness(status);
      await expect(
        tools.updateContentEntry(ARGS, USER, { dryRun: false } as ToolContext),
      ).rejects.toThrow(/title is required/);
      expect(update).not.toHaveBeenCalled();
    });

    it('a complete payload passes the dry run and the real write alike', async () => {
      const complete = { ...ARGS, data: { title: 'Still here', body: 'x' } };
      const dry = harness(status);
      await expect(
        dry.tools.updateContentEntry(complete, USER, { dryRun: true } as ToolContext),
      ).resolves.toMatchObject({ action: 'update_content_entry', entryId: 'e1' });
      const wet = harness(status);
      await expect(
        wet.tools.updateContentEntry(complete, USER, { dryRun: false } as ToolContext),
      ).resolves.toBeDefined();
      expect(wet.update).toHaveBeenCalled();
    });
  },
);

describe('MCP dry run vs real write on a DRAFT entry', () => {
  it('allows the incomplete payload in both, since the entry is not public', async () => {
    const dry = harness('DRAFT');
    await expect(
      dry.tools.updateContentEntry(ARGS, USER, { dryRun: true } as ToolContext),
    ).resolves.toMatchObject({ action: 'update_content_entry', entryId: 'e1' });
    const wet = harness('DRAFT');
    await expect(
      wet.tools.updateContentEntry(ARGS, USER, { dryRun: false } as ToolContext),
    ).resolves.toBeDefined();
    expect(wet.update).toHaveBeenCalled();
  });

  it('rejects a status change into PUBLISHED that the data cannot support', async () => {
    const { tools, update } = harness('DRAFT');
    await expect(
      tools.updateContentEntry({ ...ARGS, status: 'PUBLISHED' }, USER, {
        dryRun: true,
      } as ToolContext),
    ).rejects.toThrow(/title is required/);
    expect(update).not.toHaveBeenCalled();
  });
});
