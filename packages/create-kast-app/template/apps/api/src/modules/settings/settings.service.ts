import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type GlobalSetting } from '@prisma/client';
import { createTransport, type Transporter } from 'nodemailer';
import { SYSTEM_ROLES } from '../../common/constants/roles.constants';
import type { AuthUser } from '../../common/types/auth.types';
import { decryptSecret, encryptSecret } from '../../common/utils/secret-crypto.util';
import type { Env } from '../../config/env.schema';
import { TestSmtpDto } from './dto/test-smtp.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { isSecretSettingKey, toSafeSetting, type SafeSetting } from './settings-secret.util';
import { SettingsRepository, type SettingPatch } from './settings.repository';

/** Roles allowed to learn that a secret setting exists at all. */
const SECRET_READER_ROLES: string[] = [SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN];

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private readonly encryptionKey: string;

  constructor(
    private readonly repo: SettingsRepository,
    config: ConfigService<Env>,
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
   * stored credential back out of the API.
   */
  async getAll(user?: AuthUser): Promise<SafeSetting[]> {
    const rows = await this.repo.findAll();
    const maySeeSecrets = (user?.roles ?? []).some((role) => SECRET_READER_ROLES.includes(role));
    return rows.filter((row) => maySeeSecrets || !isSecretSettingKey(row.key)).map(toSafeSetting);
  }

  /** Returns public settings as a flat { key: value } map for delivery callers. */
  async getPublicSettings(): Promise<Record<string, unknown>> {
    const rows = await this.repo.findPublic();
    const out: Record<string, unknown> = {};
    for (const row of rows) {
      if (isSecretSettingKey(row.key)) continue;
      out[row.key] = row.value;
    }
    return out;
  }

  async patch(dto: UpdateSettingsDto, user: AuthUser): Promise<SafeSetting[]> {
    const patches: SettingPatch[] = dto.settings.map(({ key, value }) =>
      isSecretSettingKey(key)
        ? this.buildSecretPatch(key, value, user)
        : { key, value: value as Prisma.InputJsonValue },
    );
    const rows = await this.repo.upsertMany(patches, user.id);
    return rows.map(toSafeSetting);
  }

  async testSmtp(dto: TestSmtpDto): Promise<{ success: boolean }> {
    const settings = await this.repo.findAll();
    const transport = this.buildTransporter(settings);
    const from = this.getStringValue(settings, 'smtp.from') || 'noreply@kast.io';
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

  async testStorage(): Promise<{ provider: string; status: string }> {
    const settings = await this.repo.findAll();
    const provider = this.getStringValue(settings, 'storage.provider') || 'LOCAL';
    return { provider, status: 'configured' };
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
