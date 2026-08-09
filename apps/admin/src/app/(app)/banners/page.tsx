import Link from 'next/link';
import { cookies } from 'next/headers';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api, ApiError } from '@/lib/api';

type BannerRow = {
  id: string;
  title: string;
  type: string;
  status: string;
  isGlobal: boolean;
  image?: string | null;
  priority: number;
  branches: Array<{ branch: { code: string; name: string } }>;
};

export default async function BannersPage() {
  const token = cookies().get('admin_session')?.value;
  const headers: Record<string, string> | undefined = token
    ? { Cookie: `admin_session=${token}` }
    : undefined;

  let banners: BannerRow[] = [];
  let error: string | null = null;
  try {
    banners = await api<BannerRow[]>('/banners', { token, cache: 'no-store', headers });
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load banners';
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Banners</h1>
          <p className="text-sm text-muted-foreground">
            Hero, promo and announcement banners — type, status, image, branch scope
          </p>
        </div>
        <Button asChild>
          <Link href="/banners/new">Add banner</Link>
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Banner catalogue ({banners.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Preview</th>
                <th className="pb-2 font-medium">Title</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium">Branches</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {banners.map((b) => (
                <tr key={b.id} className="border-b last:border-0">
                  <td className="py-3">
                    {b.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={b.image}
                        alt=""
                        className="h-12 w-20 rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-20 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                        No image
                      </div>
                    )}
                  </td>
                  <td className="py-3 font-medium">{b.title}</td>
                  <td className="py-3">{b.type}</td>
                  <td className="py-3">
                    {b.isGlobal
                      ? 'All branches'
                      : b.branches.map((x) => x.branch.code).join(', ') || '—'}
                  </td>
                  <td className="py-3">
                    <Badge
                      variant={
                        b.status === 'ACTIVE'
                          ? 'success'
                          : b.status === 'ARCHIVED'
                            ? 'secondary'
                            : 'outline'
                      }
                    >
                      {b.status}
                    </Badge>
                  </td>
                  <td className="py-3 text-right">
                    <Link href={`/banners/${b.id}`} className="underline">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
              {!error && banners.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No banners yet —{' '}
                    <Link href="/banners/new" className="underline">
                      add one
                    </Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
