import { Injectable } from '@nestjs/common';
import { Errors } from '../errors';
import type { AuthenticatedUser } from '../auth-context';

/**
 * Branch isolation — the single choke point for cross-branch authorisation.
 *
 * Allowed branch IDs are derived exclusively from the authenticated user's
 * database rows (UserBranch / isGlobal). Branch IDs arriving in URLs, query
 * strings, or payloads are ALWAYS validated against that set. A mismatch is
 * a 403; there is no code path that trusts a client-supplied branch ID.
 */
@Injectable()
export class BranchAccessService {
  /** Throws 403 unless the user may access the given branch. */
  assertCanAccess(user: AuthenticatedUser, branchId: string): void {
    if (user.isGlobal) return;
    if (!user.branchIds.has(branchId)) {
      throw Errors.branchAccessDenied();
    }
  }

  /** Throws 403 unless the user may access every one of the given branches. */
  assertCanAccessAll(user: AuthenticatedUser, branchIds: string[]): void {
    for (const id of branchIds) this.assertCanAccess(user, id);
  }

  /**
   * Returns the Prisma `where` fragment limiting a query to authorised branches.
   * Global users get no filter; branch users get an IN(...) filter.
   */
  branchFilter(user: AuthenticatedUser): { branchId?: { in: string[] } } {
    if (user.isGlobal) return {};
    return { branchId: { in: [...user.branchIds] } };
  }

  /**
   * Resolves the effective branch scope for a request:
   * - requested IDs provided → validate each against the user's grants;
   * - nothing requested → all branches the user can access (undefined = all, for global users).
   */
  resolveScope(user: AuthenticatedUser, requestedBranchIds?: string[]): string[] | undefined {
    if (requestedBranchIds && requestedBranchIds.length > 0) {
      this.assertCanAccessAll(user, requestedBranchIds);
      return requestedBranchIds;
    }
    return user.isGlobal ? undefined : [...user.branchIds];
  }

  /**
   * Prisma `where` for entities with `allBranches` + M2M `branches`.
   * Branch users see org-wide rows plus those linked to their branches.
   */
  allBranchesOrAssignedFilter(user: AuthenticatedUser):
    | Record<string, never>
    | { OR: Array<{ allBranches: true } | { branches: { some: { branchId: { in: string[] } } } }> } {
    if (user.isGlobal) return {};
    const ids = [...user.branchIds];
    return {
      OR: [{ allBranches: true }, { branches: { some: { branchId: { in: ids } } } }],
    };
  }

  /**
   * Throws unless the user may manage an entity scoped by allBranches / branch links.
   * Org-wide (`allBranches`) rows are HQ-only for mutation; branch users need overlap.
   */
  assertCanManageBranchScoped(
    user: AuthenticatedUser,
    entity: { allBranches?: boolean; branches: Array<{ branchId: string }> },
  ): void {
    if (user.isGlobal) return;
    if (entity.allBranches) {
      throw Errors.forbidden('Only HQ users can manage organisation-wide records.');
    }
    if (entity.branches.length === 0) {
      throw Errors.forbidden('Only HQ users can manage organisation-wide records.');
    }
    const overlap = entity.branches.some((b) => user.branchIds.has(b.branchId));
    if (!overlap) throw Errors.branchAccessDenied();
  }
}
