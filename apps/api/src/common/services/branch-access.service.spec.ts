import { BranchAccessService } from './branch-access.service';
import type { AuthenticatedUser } from '../auth-context';
import type { Permission } from '@repo/types';

function user(partial: Partial<AuthenticatedUser> & Pick<AuthenticatedUser, 'isGlobal' | 'branchIds'>): AuthenticatedUser {
  return {
    id: 'u1',
    email: 'a@b.c',
    firstName: 'A',
    lastName: 'B',
    mfaEnabled: false,
    permissions: new Set<Permission>(),
    sessionId: 's1',
    ...partial,
  };
}

describe('BranchAccessService', () => {
  const service = new BranchAccessService();

  it('allows global users any branch', () => {
    expect(() =>
      service.assertCanAccess(user({ isGlobal: true, branchIds: new Set() }), 'any'),
    ).not.toThrow();
  });

  it('blocks branch users from foreign branches', () => {
    expect(() =>
      service.assertCanAccess(user({ isGlobal: false, branchIds: new Set(['gla']) }), 'edi'),
    ).toThrow();
  });

  it('allows branch users their own branch', () => {
    expect(() =>
      service.assertCanAccess(user({ isGlobal: false, branchIds: new Set(['gla']) }), 'gla'),
    ).not.toThrow();
  });

  it('resolveScope validates requested IDs', () => {
    const u = user({ isGlobal: false, branchIds: new Set(['gla', 'pai']) });
    expect(service.resolveScope(u, ['gla'])).toEqual(['gla']);
    expect(() => service.resolveScope(u, ['edi'])).toThrow();
  });
});
