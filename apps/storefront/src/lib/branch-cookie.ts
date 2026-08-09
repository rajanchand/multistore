export const BRANCH_COOKIE = 'preferred_branch';
export const BRANCH_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function setPreferredBranchCookie(branchId: string) {
  document.cookie = `${BRANCH_COOKIE}=${encodeURIComponent(branchId)}; path=/; max-age=${BRANCH_COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function getPreferredBranchCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${BRANCH_COOKIE}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}
