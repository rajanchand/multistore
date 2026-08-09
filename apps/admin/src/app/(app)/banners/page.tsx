import { cookies } from 'next/headers';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api } from '@/lib/api';

export default async function BannersPage() {
  const token = cookies().get('admin_session')?.value;
  const banners = await api<Array<{ id: string; title: string; type: string; status: string; isGlobal: boolean }>>(
    '/banners',
    { token, cache: 'no-store', headers: token ? { Cookie: `admin_session=${token}` } : {} },
  ).catch(() => []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Banners</h1>
        <p className="text-sm text-muted-foreground">CMS for storefront hero and promotional surfaces</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Banner catalogue</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Title</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium">Scope</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {banners.map((b) => (
                <tr key={b.id} className="border-b last:border-0">
                  <td className="py-3 font-medium">{b.title}</td>
                  <td className="py-3">{b.type}</td>
                  <td className="py-3">{b.isGlobal ? 'Global' : 'Selected branches'}</td>
                  <td className="py-3">
                    <Badge variant="secondary">{b.status}</Badge>
                  </td>
                </tr>
              ))}
              {banners.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted-foreground">
                    No banners yet
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
