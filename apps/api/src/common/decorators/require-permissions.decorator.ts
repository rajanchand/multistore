import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@repo/types';

export const PERMISSIONS_KEY = 'required_permissions';

/**
 * Declares the permissions required to call a handler.
 * Enforced by PermissionsGuard; the user needs ALL listed permissions.
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
