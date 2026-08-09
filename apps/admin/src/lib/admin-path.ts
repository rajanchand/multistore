/** Public basePath when admin is mounted under e.g. `/admin` (empty locally). */
export function adminBasePath(): string {
  return (process.env.NEXT_PUBLIC_ADMIN_BASE_PATH ?? '').replace(/\/$/, '');
}

/** Absolute same-origin path, respecting ADMIN_BASE_PATH. */
export function adminPath(path: string): string {
  const base = adminBasePath();
  const normalised = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalised}`;
}
