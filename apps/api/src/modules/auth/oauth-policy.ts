import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const OAUTH_SIGNUP_MODES = ['disabled', 'allowlist', 'open'] as const;
export type OAuthSignupMode = (typeof OAUTH_SIGNUP_MODES)[number];

export interface OAuthProvisionDecision {
  allowed: boolean;
  reason: string;
}

/**
 * Decides whether an OAuth identity the install has never seen may become an
 * account. Any provider will hand back an address for any inbox its own users
 * control, so auto-provisioning is a self-registration policy rather than an
 * authentication detail, and it stays closed until an operator opens it:
 *
 *   OAUTH_SIGNUP_MODE              disabled (default) | allowlist | open
 *   OAUTH_SIGNUP_ALLOWED_DOMAINS   comma-separated email domains, allowlist mode
 *   OAUTH_SIGNUP_REQUIRE_VERIFIED  'false' to accept providers that do not
 *                                  assert verification (GitHub); default true
 *
 * These are read straight from the environment rather than the validated Env
 * schema so the auth module owns its own policy surface.
 */
@Injectable()
export class OAuthPolicy {
  private readonly logger = new Logger(OAuthPolicy.name);
  private readonly mode: OAuthSignupMode;
  private readonly allowedDomains: string[];
  private readonly requireVerifiedEmail: boolean;

  constructor(config: ConfigService) {
    this.mode = this.readMode(config.get<string>('OAUTH_SIGNUP_MODE'));
    this.allowedDomains = (config.get<string>('OAUTH_SIGNUP_ALLOWED_DOMAINS') ?? '')
      .split(',')
      .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
      .filter((d) => d.length > 0);
    this.requireVerifiedEmail =
      (config.get<string>('OAUTH_SIGNUP_REQUIRE_VERIFIED') ?? 'true') !== 'false';

    if (this.mode === 'allowlist' && this.allowedDomains.length === 0) {
      this.logger.warn(
        'OAUTH_SIGNUP_MODE=allowlist with no OAUTH_SIGNUP_ALLOWED_DOMAINS — every OAuth signup will be refused',
      );
    }
  }

  /**
   * Applies the policy to a brand-new identity. `verified` is what the provider
   * claimed: `undefined` means it said nothing, which only passes when the
   * install has explicitly waived the verification requirement.
   */
  canProvision(email: string, verified: boolean | undefined): OAuthProvisionDecision {
    if (this.mode === 'disabled') {
      return { allowed: false, reason: 'OAuth self-registration is disabled on this installation' };
    }
    if (this.requireVerifiedEmail && verified !== true) {
      return {
        allowed: false,
        reason: 'OAuth provider did not confirm the email address is verified',
      };
    }
    if (this.mode === 'allowlist' && !this.allowedDomains.includes(this.domainOf(email))) {
      return { allowed: false, reason: 'Email domain is not allowed to self-register' };
    }
    return { allowed: true, reason: 'allowed' };
  }

  private domainOf(email: string): string {
    return email.slice(email.lastIndexOf('@') + 1).toLowerCase();
  }

  /** An unrecognised value fails closed: signups stay off until it is corrected. */
  private readMode(raw: string | undefined): OAuthSignupMode {
    if (raw === undefined || raw.length === 0) return 'disabled';
    const candidate = raw.trim().toLowerCase();
    if ((OAUTH_SIGNUP_MODES as readonly string[]).includes(candidate)) {
      return candidate as OAuthSignupMode;
    }
    this.logger.warn(`Unknown OAUTH_SIGNUP_MODE "${raw}" — falling back to "disabled"`);
    return 'disabled';
  }
}
