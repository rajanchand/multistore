import { cookies } from 'next/headers';
import { api } from '@/lib/api';
import { ProductForm } from '@/components/product-form';

export default async function NewProductPage() {
  const token = cookies().get('admin_session')?.value;
  let branches: Array<{ id: string; name: string; code: string }> = [];
  try {
    const list = await api<typeof branches>('/branches', {
      token,
      cache: 'no-store',
      headers: token ? { Cookie: `admin_session=${token}` } : {},
    });
    branches = list.filter((b) => b.code !== 'HQ');
  } catch {
    branches = [];
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Create product</h1>
        <p className="text-sm text-muted-foreground">
          Add a catalogue product with pricing. Optionally attach it to one or more stores on save.
        </p>
      </div>
      <ProductForm mode="create" branches={branches} />
    </div>
  );
}
