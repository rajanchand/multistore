import Link from 'next/link';
import { cookies } from 'next/headers';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api, ApiError } from '@/lib/api';
import { FaqForm } from '@/components/faq-form';

export default async function SettingsFaqsPage() {
  const token = cookies().get('admin_session')?.value;
  let faqs: Array<{
    id: string;
    question: string;
    answer: string;
    category: string;
    isPublished: boolean;
    sortOrder: number;
  }> = [];
  let error: string | null = null;

  try {
    faqs = await api<typeof faqs>('/faqs?includeUnpublished=true', {
      token,
      cache: 'no-store',
      headers: token ? { Cookie: `admin_session=${token}` } : {},
    });
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load FAQs';
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/settings" className="hover:underline">
            Settings
          </Link>{' '}
          / FAQs
        </p>
        <h1 className="mt-1 text-2xl font-semibold">FAQs</h1>
        <p className="text-sm text-muted-foreground">Customer help content for the storefront</p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Add FAQ</CardTitle>
        </CardHeader>
        <CardContent>
          <FaqForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Published & draft ({faqs.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {faqs.map((faq) => (
            <div key={faq.id} className="border-b pb-4 last:border-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{faq.question}</p>
                <Badge variant="outline">{faq.category}</Badge>
                <Badge variant={faq.isPublished ? 'success' : 'secondary'}>
                  {faq.isPublished ? 'Published' : 'Draft'}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{faq.answer}</p>
            </div>
          ))}
          {!error && faqs.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No FAQs yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
