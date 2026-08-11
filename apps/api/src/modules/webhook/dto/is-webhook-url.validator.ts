import {
  registerDecorator,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidationOptions,
  type ValidatorConstraintInterface,
} from 'class-validator';
import {
  checkOutboundUrlSyntax,
  parseHostAllowList,
  type BlockedUrlReason,
} from '../../../common/utils/ssrf-guard.util';

const REASON_MESSAGES: Record<BlockedUrlReason, string> = {
  invalid_url: 'must be a valid absolute URL',
  unsupported_scheme: 'must use the http or https scheme',
  private_address: 'must not point at a loopback, private, or link-local host',
  dns_failure: 'host could not be resolved',
  too_many_redirects: 'target redirects too many times',
};

// class-validator constraints are instantiated outside the Nest container, so
// there is no ConfigService here — process.env is the same source it reads.
function currentAllowList(): string[] {
  return parseHostAllowList(process.env.WEBHOOK_ALLOWED_HOSTS);
}

@ValidatorConstraint({ name: 'isWebhookUrl', async: false })
export class IsWebhookUrlConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    return checkOutboundUrlSyntax(value, currentAllowList()).ok;
  }

  defaultMessage(args: ValidationArguments): string {
    const value = args.value as unknown;
    if (typeof value !== 'string') return `${args.property} must be a string`;
    const result = checkOutboundUrlSyntax(value, currentAllowList());
    const detail = result.ok ? 'is not allowed' : REASON_MESSAGES[result.reason];
    return `${args.property} ${detail}`;
  }
}

/** Rejects non-http(s) URLs and hosts that are literally internal, before any DNS lookup. */
export function IsWebhookUrl(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      target: object.constructor,
      propertyName,
      ...(validationOptions ? { options: validationOptions } : {}),
      validator: IsWebhookUrlConstraint,
    });
  };
}
