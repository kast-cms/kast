import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma, type GlobalSetting } from '@prisma/client';
import { createTransport, type Transporter } from 'nodemailer';
import { TestSmtpDto } from './dto/test-smtp.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsRepository, type SettingPatch } from './settings.repository';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly repo: SettingsRepository) {}

  getAll(): Promise<GlobalSetting[]> {
    return this.repo.findAll();
  }

  patch(dto: UpdateSettingsDto, updatedBy: string): Promise<GlobalSetting[]> {
    const patches: SettingPatch[] = dto.settings.map(({ key, value }) => ({
      key,
      value: value as Prisma.InputJsonValue,
    }));
    return this.repo.upsertMany(patches, updatedBy);
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

  private getStringValue(settings: GlobalSetting[], key: string): string {
    const found = settings.find((s) => s.key === key);
    return typeof found?.value === 'string' ? found.value : '';
  }

  private buildTransporter(settings: GlobalSetting[]): Transporter {
    const host = this.getStringValue(settings, 'smtp.host');
    if (!host) throw new BadRequestException('SMTP host is not configured');
    const port = parseInt(this.getStringValue(settings, 'smtp.port') || '587', 10);
    const user = this.getStringValue(settings, 'smtp.user');
    const pass = this.getStringValue(settings, 'smtp.password');
    return createTransport({
      host,
      port,
      secure: port === 465,
      ...(user ? { auth: { user, pass } } : {}),
    });
  }
}
