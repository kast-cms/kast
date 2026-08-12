import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema';
import { decryptSecret, encryptSecret, isEncryptedSecret } from '../utils/secret-crypto.util';

export interface DecryptedSecret {
  plaintext: string;
  rotatedCiphertext?: string;
}

@Injectable()
export class SecretEncryptionService {
  private readonly logger = new Logger(SecretEncryptionService.name);
  private readonly activeKey: string;
  private readonly legacyKeys: string[];

  constructor(config: ConfigService<Env>) {
    const jwtKey = config.get('JWT_SECRET', { infer: true });
    const dedicated = config.get('KAST_SECRET_ENCRYPTION_KEY', { infer: true });
    const usableDedicated = dedicated && dedicated.length >= 32 ? dedicated : undefined;
    this.activeKey = usableDedicated ?? jwtKey ?? '';
    if (this.activeKey.length < 32) {
      throw new Error('A secret encryption key of at least 32 characters is required');
    }
    const configuredPrevious = (
      config.get('KAST_SECRET_ENCRYPTION_PREVIOUS_KEYS', { infer: true }) ?? ''
    )
      .split(',')
      .map((key) => key.trim())
      .filter((key) => key.length >= 32 && key !== this.activeKey);
    this.legacyKeys = [
      ...new Set([...configuredPrevious, ...(jwtKey && jwtKey !== this.activeKey ? [jwtKey] : [])]),
    ];
    if (!usableDedicated) {
      this.logger.warn(
        'KAST_SECRET_ENCRYPTION_KEY is unset; development secrets use JWT_SECRET. Production validation rejects this configuration.',
      );
    }
  }

  encrypt(plaintext: string): string {
    return encryptSecret(plaintext, this.activeKey);
  }

  decrypt(stored: string): string {
    return this.decryptAndRotate(stored).plaintext;
  }

  decryptAndRotate(stored: string): DecryptedSecret {
    if (!isEncryptedSecret(stored)) {
      return { plaintext: stored, rotatedCiphertext: this.encrypt(stored) };
    }
    try {
      return { plaintext: decryptSecret(stored, this.activeKey) };
    } catch (activeError) {
      for (const key of this.legacyKeys) {
        try {
          const plaintext = decryptSecret(stored, key);
          return { plaintext, rotatedCiphertext: this.encrypt(plaintext) };
        } catch {
          // Try the next explicitly supported legacy key.
        }
      }
      throw activeError;
    }
  }
}
