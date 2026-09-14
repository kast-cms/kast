import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { generateURI, generateSecret as otplibSecret, verifySync } from 'otplib';
import type { Env } from '../../config/env.schema';

export const RECOVERY_CODE_COUNT = 10;

/** A verified TOTP code plus the timestep it matched, for replay bookkeeping. */
export type TotpVerdict = { ok: true; timeStep: number } | { ok: false };

/**
 * TOTP and recovery-code primitives for the auth module. Verification returns
 * the matched timestep rather than a bare boolean so the caller can persist it
 * and refuse any code from the same or an earlier window — a code observed by
 * an attacker must not be worth anything for the rest of its 30-second life.
 */
@Injectable()
export class TotpService {
  private readonly issuer: string;

  constructor(config: ConfigService<Env>) {
    this.issuer = config.get('TOTP_ISSUER', { infer: true }) ?? 'Kast';
  }

  generateSecret(): string {
    return otplibSecret({ length: 20 });
  }

  buildOtpauthUri(secret: string, account: string): string {
    return generateURI({ issuer: this.issuer, label: account, secret });
  }

  /**
   * Accepts ± one timestep of clock drift. A malformed code is rejected
   * outright rather than handed to the verifier: the login form feeds both
   * TOTP and recovery codes into one field, and only the 6-digit shape is a
   * plausible TOTP code.
   */
  verifyTotp(code: string, secret: string, lastCounter: number | null): TotpVerdict {
    if (!/^\d{6}$/.test(code)) return { ok: false };
    const result = verifySync({ secret, token: code, epochTolerance: 30 });
    if (!result.valid || !('timeStep' in result) || typeof result.timeStep !== 'number')
      return { ok: false };
    if (lastCounter !== null && result.timeStep <= lastCounter) return { ok: false };
    return { ok: true, timeStep: result.timeStep };
  }

  /** Ten url-safe single-use codes; only the SHA-256 digests are ever stored. */
  generateRecoveryCodes(): { raw: string[]; hashes: string[] } {
    const raw = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
      randomBytes(8).toString('base64url'),
    );
    return { raw, hashes: raw.map((code) => hashRecoveryCode(code)) };
  }

  /** Index of the matching stored hash, or null. Caller removes the hash. */
  verifyRecoveryCode(code: string, hashes: readonly string[]): number | null {
    const digest = Buffer.from(hashRecoveryCode(code), 'hex');
    for (let i = 0; i < hashes.length; i++) {
      const stored = Buffer.from(hashes[i] ?? '', 'hex');
      if (stored.length === digest.length && timingSafeEqual(stored, digest)) return i;
    }
    return null;
  }
}

export function hashRecoveryCode(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/** Loads and parses the stored recovery-code JSON column, failing closed. */
export function parseRecoveryHashes(stored: string | null): string[] {
  if (stored === null) return [];
  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== 'string')) {
      throw new BadRequestException('Stored recovery codes are malformed');
    }
    return parsed as string[];
  } catch (err) {
    if (err instanceof BadRequestException) throw err;
    throw new BadRequestException('Stored recovery codes are malformed');
  }
}
