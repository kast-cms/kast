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
import type { AuthUser } from '../../common/types/auth.types';
import { decryptSecret, encryptSecret } from '../../common/utils/secret-crypto.util';
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

export interface StorageProbeResult {
  provider: string;
  status: string;
  checks: { write: boolean; read: boolean; delete: boolean };
  warning?: string;
}

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private readonly encryptionKey: string;

  constructor(
    private readonly repo: SettingsRepository,
    private readonly config: ConfigService<Env>,
    @Inject(STORAGE_PROBE_ADAPTER) private readonly storage: StorageAdapter,
  ) {
    // KAST_SECRET_ENCRYPTION_KEY is intentionally read from the process env
    // rather than the validated schema so an existing deployment keeps booting
    // without it; the JWT_SECRET fallback ties secret readability to JWT
    // rotation, which the warning below tells operators to avoid.
    const dedicated = process.env.KAST_SECRET_ENCRYPTION_KEY;
    if (dedicated && dedicated.length >= 32) {
      this.encryptionKey = dedicated;
    } else {
      if (dedicated) {
        this.logger.warn(
          'KAST_SECRET_ENCRYPTION_KEY is shorter than 32 characters and was ignored.',
        );
      }
      this.logger.warn(
        'KAST_SECRET_ENCRYPTION_KEY is not set — secret settings are encrypted with JWT_SECRET. Rotating JWT_SECRET will make them unreadable.',
      );
      this.encryptionKey = config.get('JWT_SECRET', { infer: true }) ?? 'kast-dev-secret';
    }
  }

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
    const settings = await this.repo.findAll();
    const transport = this.buildTransporter(settings);
    const address = this.getStringValue(settings, 'smtp.from') || 'noreply@kast.io';
    const fromName = this.getStringValue(settings, 'smtp.fromName');
    const from = fromName ? `${fromName} <${address}>` : address;
    try {
      await transport.sendMail({
        from,
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

  /**
   * Writes, reads back and removes a probe object through the adapter the API
   * actually uploads with. The provider is reported from the environment
   * because that — not any stored setting — is what selects the adapter.
   */
  async testStorage(): Promise<StorageProbeResult> {
    const configured = this.config.get('STORAGE_PROVIDER', { infer: true }) ?? 'local';
    const effective = configured === 'gcs' ? 'local' : configured;
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
      ...(configured === effective
        ? {}
        : {
            warning: `STORAGE_PROVIDER=${configured} has no adapter; the ${effective} adapter is in use.`,
          }),
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
      value: value === '' ? '' : encryptSecret(value, this.encryptionKey),
      isPublic: false,
    };
  }

  private getStringValue(settings: GlobalSetting[], key: string): string {
    const found = settings.find((s) => s.key === key);
    return typeof found?.value === 'string' ? found.value : '';
  }

  private getSecretValue(settings: GlobalSetting[], key: string): string {
    const stored = this.getStringValue(settings, key);
    if (!stored) return '';
    try {
      return decryptSecret(stored, this.encryptionKey);
    } catch {
      throw new BadRequestException(
        `Stored value for "${key}" could not be decrypted. Re-save it in Settings.`,
      );
    }
  }

  private buildTransporter(settings: GlobalSetting[]): Transporter {
    const host = this.getStringValue(settings, 'smtp.host');
    if (!host) throw new BadRequestException('SMTP host is not configured');
    const port = parseInt(this.getStringValue(settings, 'smtp.port') || '587', 10);
    const user = this.getStringValue(settings, 'smtp.user');
    const pass = this.getSecretValue(settings, 'smtp.password');
    return createTransport({
      host,
      port,
      secure: port === 465,
      ...(user ? { auth: { user, pass } } : {}),
    });
  }
}
