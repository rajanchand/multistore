import { cookies } from 'next/headers';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api } from '@/lib/api';

export default async function PromotionsPage() {
  const token = cookies().get('admin_session')?.value;
  const data = await api<{ items: Array<{ id: string; name: string; type: string; status: string; value: number }> }>(
    '/promotions?pageSize=50',
    { token, cache: 'no-store', headers: token ? { Cookie: `admin_session=${token}` } : {} },
  ).catch(() => ({ items: [] }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Promotions</h1>
        <p className="text-sm text-muted-foreground">Server-side deterministic promotion engine</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Active & draft promotions</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium">Value</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="py-3 font-medium">{p.name}</td>
                  <td className="py-3">{p.type}</td>
                  <td className="py-3">{p.value}</td>
                  <td className="py-3">
                    <Badge variant="secondary">{p.status}</Badge>
                  </td>
                </tr>
              ))}
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted-foreground">
                    No promotions yet
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
