import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type GlobalSetting } from '@prisma/client';
import { randomUUID } from 'crypto';
import { createTransport, type Transporter } from 'nodemailer';
import { SYSTEM_ROLES } from '../../common/constants/roles.constants';
import { SecretEncryptionService } from '../../common/security/secret-encryption.service';
import type { AuthUser } from '../../common/types/auth.types';
import type { Env } from '../../config/env.schema';
import type { StorageAdapter } from '../media/storage/storage.adapter';
import { TestSmtpDto } from './dto/test-smtp.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { describeInertSetting, isInertSettingKey } from './settings-catalog';
import { isSecretSettingKey, toSafeSetting, type SafeSetting } from './settings-secret.util';
import { SettingsRepository, type SettingPatch } from './settings.repository';
import { STORAGE_PROBE_ADAPTER } from './storage-probe.token';

/** Roles allowed to learn that a secret setting exists at all. */
const SECRET_READER_ROLES: string[] = [SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN];

function firstNonEmpty(...values: Array<string | undefined>): string {
  return values.find((value) => value !== undefined && value.length > 0) ?? '';
}

export interface StorageProbeResult {
  provider: string;
  status: string;
  checks: { write: boolean; read: boolean; delete: boolean };
  warning?: string;
}

export interface RuntimeEmail {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  constructor(
    private readonly repo: SettingsRepository,
    private readonly config: ConfigService<Env>,
    @Inject(STORAGE_PROBE_ADAPTER) private readonly storage: StorageAdapter,
    private readonly secrets: SecretEncryptionService,
  ) {}

  /**
   * Secret rows are withheld entirely below admin, and reduced to
   * `{ value: null, configured }` for everyone else — no caller ever reads a
   * stored credential back out of the API. Keys the runtime does not read are
   * withheld from everyone: a setting the API shows is a setting it honours.
   */
  async getAll(user?: AuthUser): Promise<SafeSetting[]> {
    const rows = await this.repo.findAll();
    const maySeeSecrets = (user?.roles ?? []).some((role) => SECRET_READER_ROLES.includes(role));
    return rows
      .filter((row) => !isInertSettingKey(row.key))
      .filter((row) => maySeeSecrets || !isSecretSettingKey(row.key))
      .map(toSafeSetting);
  }

  /** Returns public settings as a flat { key: value } map for delivery callers. */
  async getPublicSettings(): Promise<Record<string, unknown>> {
    const rows = await this.repo.findPublic();
    const out: Record<string, unknown> = {};
    for (const row of rows) {
      if (isSecretSettingKey(row.key) || isInertSettingKey(row.key)) continue;
      out[row.key] = row.value;
    }
    return out;
  }

  async patch(dto: UpdateSettingsDto, user: AuthUser): Promise<SafeSetting[]> {
    const inert = dto.settings.filter(({ key }) => isInertSettingKey(key));
    if (inert.length > 0) {
      throw new BadRequestException(inert.map(({ key }) => describeInertSetting(key)).join(' '));
    }
    const patches: SettingPatch[] = dto.settings.map(({ key, value, isPublic }) =>
      isSecretSettingKey(key)
        ? this.buildSecretPatch(key, value, user)
        : {
            key,
            value: value as Prisma.InputJsonValue,
            ...(isPublic === undefined ? {} : { isPublic }),
          },
    );
    const rows = await this.repo.upsertMany(patches, user.id);
    return rows.map(toSafeSetting);
  }

  async testSmtp(dto: TestSmtpDto): Promise<{ success: boolean }> {
    try {
      await this.sendEmail({
        to: dto.to,
        subject: 'KAST SMTP Test',
        text: 'This is a test email sent from KAST to verify your SMTP configuration.',
      });
      return { success: true };
    } catch (err: unknown) {
      this.logger.error('SMTP test failed', err);
      throw new BadRequestException(`SMTP test failed: ${String(err)}`);
    }
  }

  /** Sends queued transactional mail through saved SMTP settings, with env fallback. */
  async sendEmail(message: RuntimeEmail): Promise<void> {
    const settings = await this.repo.findAll();
    const address = firstNonEmpty(
      this.getStringValue(settings, 'smtp.from'),
      this.config.get('SMTP_FROM', { infer: true }),
      'noreply@kast.io',
    );
    const fromName = this.getStringValue(settings, 'smtp.fromName');
    const from = fromName ? `${fromName} <${address}>` : address;
    await (await this.buildTransporter(settings)).sendMail({ from, ...message });
  }

  async getSiteName(): Promise<string> {
    const row = await this.repo.findByKey('site.name');
    return typeof row?.value === 'string' && row.value.trim() ? row.value.trim() : 'Kast CMS';
  }

  /**
   * Writes, reads back and removes a probe object through the adapter the API
   * actually uploads with. The provider is reported from the environment
   * because that — not any stored setting — is what selects the adapter.
   */
  async testStorage(): Promise<StorageProbeResult> {
    const configured = this.config.get('STORAGE_PROVIDER', { infer: true }) ?? 'local';
    const effective = configured;
    // The probe travels the upload path, so the key has to satisfy the same
    // object-key rules a real upload does — no leading dot on any segment.
    const key = `kast-probe/${randomUUID()}.txt`;
    const payload = Buffer.from(`kast storage probe ${new Date().toISOString()}`, 'utf8');

    try {
      await this.storage.upload(key, payload, 'text/plain');
      const readBack = await this.storage.read(key);
      if (!readBack.equals(payload)) {
        throw new Error('the probe object read back with different contents');
      }
    } catch (err: unknown) {
      await this.removeProbe(key);
      this.logger.error(`Storage probe failed for provider "${effective}"`, err);
      throw new BadRequestException(
        `Storage test failed for provider "${effective}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return {
      provider: effective.toUpperCase(),
      status: 'ok',
      checks: { write: true, read: true, delete: await this.removeProbe(key) },
    };
  }

  private async removeProbe(key: string): Promise<boolean> {
    try {
      await this.storage.delete(key);
      return true;
    } catch (err: unknown) {
      this.logger.warn(`Storage probe object ${key} could not be deleted: ${String(err)}`);
      return false;
    }
  }

  private buildSecretPatch(key: string, value: unknown, user: AuthUser): SettingPatch {
    if (!user.roles.includes(SYSTEM_ROLES.SUPER_ADMIN)) {
      throw new ForbiddenException(`Only a super admin may change "${key}"`);
    }
    if (typeof value !== 'string') {
      throw new BadRequestException(`Setting "${key}" must be a string`);
    }
    // An empty value clears the credential; storing it verbatim keeps
    // `configured` honest instead of reporting a ciphertext of nothing.
    return {
      key,
      value: value === '' ? '' : this.secrets.encrypt(value),
      isPublic: false,
    };
  }

  private getStringValue(settings: GlobalSetting[], key: string): string {
    const found = settings.find((s) => s.key === key);
    return typeof found?.value === 'string' ? found.value : '';
  }

  private async getSecretValue(settings: GlobalSetting[], key: string): Promise<string> {
    const stored = this.getStringValue(settings, key);
    if (!stored) return '';
    try {
      const decrypted = this.secrets.decryptAndRotate(stored);
      if (decrypted.rotatedCiphertext) {
        await this.repo.upsert(key, decrypted.rotatedCiphertext, undefined);
      }
      return decrypted.plaintext;
    } catch {
      throw new BadRequestException(
        `Stored value for "${key}" could not be decrypted. Re-save it in Settings.`,
      );
    }
  }

  private async buildTransporter(settings: GlobalSetting[]): Promise<Transporter> {
    const host = firstNonEmpty(
      this.getStringValue(settings, 'smtp.host'),
      this.config.get('SMTP_HOST', { infer: true }),
      'localhost',
    );
    const port = parseInt(
      firstNonEmpty(
        this.getStringValue(settings, 'smtp.port'),
        String(this.config.get('SMTP_PORT', { infer: true }) ?? 1025),
      ),
      10,
    );
    const user = firstNonEmpty(
      this.getStringValue(settings, 'smtp.user'),
      this.config.get('SMTP_USER', { infer: true }),
    );
    const storedPassword = this.getStringValue(settings, 'smtp.password');
    const pass = storedPassword
      ? await this.getSecretValue(settings, 'smtp.password')
      : (this.config.get('SMTP_PASS', { infer: true }) ?? '');
    return createTransport({
      host,
      port,
      secure: port === 465 || (this.config.get('SMTP_SECURE', { infer: true }) ?? false),
      ...(user ? { auth: { user, pass } } : {}),
    });
  }
}
