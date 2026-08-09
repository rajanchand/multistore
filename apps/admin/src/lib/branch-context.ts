import { cookies } from 'next/headers';

export const ADMIN_BRANCH_COOKIE = 'admin_branch_id';

/** Selected HQ branch filter from cookie (null = all branches). */
export function getSelectedBranchId(): string | null {
  const value = cookies().get(ADMIN_BRANCH_COOKIE)?.value;
  if (!value || value === 'all') return null;
  return value;
}

/** Append branchIds / branchId query params for list APIs. */
export function withBranchQuery(path: string, branchId: string | null): string {
  if (!branchId) return path;
  const sep = path.includes('?') ? '&' : '?';
  // Analytics/reports use branchIds=; orders/inventory/products use branchId=
  if (path.startsWith('/analytics') || path.startsWith('/reports')) {
    return `${path}${sep}branchIds=${encodeURIComponent(branchId)}`;
  }
  return `${path}${sep}branchId=${encodeURIComponent(branchId)}`;
}
