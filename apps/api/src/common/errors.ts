import { HttpException, HttpStatus } from '@nestjs/common';

/** Domain error with a stable machine-readable code. */
export class DomainException extends HttpException {
  constructor(code: string, message: string, status: HttpStatus, details?: unknown) {
    super({ code, message, details }, status);
  }
}

export const Errors = {
  insufficientStock: (sku?: string) =>
    new DomainException(
      'INSUFFICIENT_STOCK',
      sku ? `The requested quantity of ${sku} is unavailable.` : 'The requested quantity is unavailable.',
      HttpStatus.CONFLICT,
    ),
  branchAccessDenied: () =>
    new DomainException('BRANCH_ACCESS_DENIED', 'You do not have access to this branch.', HttpStatus.FORBIDDEN),
  invalidCredentials: () =>
    new DomainException('INVALID_CREDENTIALS', 'Invalid email or password.', HttpStatus.UNAUTHORIZED),
  accountLocked: () =>
    new DomainException(
      'ACCOUNT_LOCKED',
      'Account temporarily locked after repeated failed logins. Try again later.',
      HttpStatus.UNAUTHORIZED,
    ),
  mfaRequired: () =>
    new DomainException('MFA_REQUIRED', 'A multi-factor authentication code is required.', HttpStatus.UNAUTHORIZED),
  invalidMfaCode: () =>
    new DomainException('INVALID_MFA_CODE', 'The authentication code is invalid.', HttpStatus.UNAUTHORIZED),
  notFound: (resource: string) =>
    new DomainException('NOT_FOUND', `${resource} not found.`, HttpStatus.NOT_FOUND),
  validation: (details: unknown) =>
    new DomainException('VALIDATION_FAILED', 'Request validation failed.', HttpStatus.UNPROCESSABLE_ENTITY, details),
  conflict: (code: string, message: string) => new DomainException(code, message, HttpStatus.CONFLICT),
  badRequest: (code: string, message: string) => new DomainException(code, message, HttpStatus.BAD_REQUEST),
  forbidden: (message = 'You do not have permission to perform this action.') =>
    new DomainException('FORBIDDEN', message, HttpStatus.FORBIDDEN),
  invalidTransition: (from: string, to: string) =>
    new DomainException('INVALID_STATE_TRANSITION', `Cannot transition from ${from} to ${to}.`, HttpStatus.CONFLICT),
};
