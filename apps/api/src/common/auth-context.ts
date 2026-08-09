import type { Permission } from '@repo/types';

/** Authenticated admin user attached to the request by AdminAuthGuard. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  isGlobal: boolean;
  mfaEnabled: boolean;
  permissions: Set<Permission>;
  /** Branch IDs the user may access. Ignored when isGlobal. */
  branchIds: Set<string>;
  sessionId: string;
}

/** Authenticated storefront customer attached by CustomerAuthGuard. */
export interface AuthenticatedCustomer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  sessionId: string;
}

export interface RequestContext {
  requestId?: string;
  ip?: string;
  userAgent?: string;
}
