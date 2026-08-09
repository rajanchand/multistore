import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { formatMoney } from '@repo/types';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api, ApiError } from '@/lib/api';
import { ProductForm } from '@/components/product-form';

interface ProductDetail {
  id: string;
  name: string;
  sku: string;
  slug: string;
  brand?: string | null;
  shortDescription?: string | null;
  status: string;
  images?: string[] | unknown;
  variants: Array<{
    id: string;
    sku: string;
    name: string;
    defaultPrice: number;
  }>;
  categories: Array<{ category: { name: string } }>;
  branchProducts?: Array<{
    id: string;
    sellingPrice: number;
    salePrice?: number | null;
    isVisible: boolean;
    branch: { name: string; code: string };
  }>;
}

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const token = cookies().get('admin_session')?.value;
  let product: ProductDetail;
  try {
    product = await api<ProductDetail>(`/products/${params.id}`, {
      token,
      cache: 'no-store',
      headers: token ? { Cookie: `admin_session=${token}` } : {},
    });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/products" className="hover:underline">
            Products
          </Link>{' '}
          / {product.sku}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">{product.name}</h1>
        <div className="mt-2 flex gap-2">
          <Badge variant={product.status === 'ACTIVE' ? 'success' : 'secondary'}>
            {product.status}
          </Badge>
          {product.brand && <Badge variant="outline">{product.brand}</Badge>}
        </div>
      </div>

      {Array.isArray(product.images) && product.images.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {(product.images as string[]).map((src, i) => (
            <div key={`${src}-${i}`} className="h-24 w-24 overflow-hidden rounded-lg border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Variants</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {product.variants.map((v) => (
              <div key={v.id} className="flex justify-between border-b py-2 last:border-0">
                <span>
                  {v.name} <span className="font-mono text-xs text-muted-foreground">{v.sku}</span>
                </span>
                <span>{formatMoney(v.defaultPrice)}</span>
              </div>
            ))}
            {product.variants.length === 0 && (
              <p className="text-muted-foreground">No variants</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Branch pricing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(product.branchProducts ?? []).map((bp) => (
              <div key={bp.id} className="flex justify-between border-b py-2 last:border-0">
                <span>
                  {bp.branch.name} ({bp.branch.code})
                </span>
                <span>
                  {bp.salePrice != null ? (
                    <>
                      <span className="text-muted-foreground line-through">
                        {formatMoney(bp.sellingPrice)}
                      </span>{' '}
                      {formatMoney(bp.salePrice)}
                    </>
                  ) : (
                    formatMoney(bp.sellingPrice)
                  )}{' '}
                  · {bp.isVisible ? 'Visible' : 'Hidden'}
                </span>
              </div>
            ))}
            {(product.branchProducts ?? []).length === 0 && (
              <p className="text-muted-foreground">
                No branch assignments yet. Assign stores when creating a product, or use Bulk
                Operations / the branch-config API.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Edit product</h2>
        <ProductForm
          mode="edit"
          initial={{
            id: product.id,
            name: product.name,
            sku: product.sku,
            slug: product.slug,
            brand: product.brand ?? '',
            shortDescription: product.shortDescription ?? '',
            status: product.status,
            images: Array.isArray(product.images) ? (product.images as string[]) : [],
          }}
        />
      </div>
    </div>
  );
}
