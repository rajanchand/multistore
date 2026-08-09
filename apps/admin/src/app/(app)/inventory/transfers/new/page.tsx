import Link from 'next/link';
import { cookies } from 'next/headers';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api } from '@/lib/api';
import {
  TransferCreateForm,
  type TransferBranchOption,
  type TransferProductOption,
} from '@/components/transfer-create-form';

type ProductListItem = {
  id: string;
  name: string;
  variants?: Array<{ id: string; name: string; sku: string }>;
};

export default async function NewTransferPage() {
  const token = cookies().get('admin_session')?.value;
  const headers: Record<string, string> | undefined = token
    ? { Cookie: `admin_session=${token}` }
    : undefined;

  const [branches, productsRes] = await Promise.all([
    api<TransferBranchOption[]>('/branches', { token, cache: 'no-store', headers }).catch(() => []),
    api<{ items: ProductListItem[] }>('/products?pageSize=100', {
      token,
      cache: 'no-store',
      headers,
    }).catch(() => ({ items: [] as ProductListItem[] })),
  ]);

  const products: TransferProductOption[] = productsRes.items
    .map((p) => ({
      id: p.id,
      name: p.name,
      variants: (p.variants ?? []).map((v) => ({ id: v.id, name: v.name, sku: v.sku })),
    }))
    .filter((p) => p.variants.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/inventory/transfers" className="hover:underline">
            Transfers
          </Link>{' '}
          / New
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Request stock transfer</h1>
        <p className="text-sm text-muted-foreground">
          Branch access is enforced server-side — client branch IDs are never trusted for auth
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transfer details</CardTitle>
        </CardHeader>
        <CardContent>
          <TransferCreateForm branches={branches} products={products} />
        </CardContent>
      </Card>
    </div>
  );
}
