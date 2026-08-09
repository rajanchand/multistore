import Link from 'next/link';
import { cookies } from 'next/headers';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api, ApiError } from '@/lib/api';
import { AboutForm } from '@/components/about-form';

export default async function SettingsAboutPage() {
  const token = cookies().get('admin_session')?.value;
  let sections: Array<{
    id: string;
    sectionKey: string;
    title: string;
    body: string;
    sortOrder: number;
    isPublished: boolean;
  }> = [];
  let error: string | null = null;

  try {
    sections = await api<typeof sections>('/about', {
      token,
      cache: 'no-store',
      headers: token ? { Cookie: `admin_session=${token}` } : {},
    });
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load about content';
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/settings" className="hover:underline">
            Settings
          </Link>{' '}
          / About
        </p>
        <h1 className="mt-1 text-2xl font-semibold">About</h1>
        <p className="text-sm text-muted-foreground">Company story and contact sections</p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Upsert section</CardTitle>
        </CardHeader>
        <CardContent>
          <AboutForm />
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {sections.map((section) => (
          <Card key={section.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {section.title}{' '}
                <span className="font-mono text-xs text-muted-foreground">({section.sectionKey})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{section.body}</p>
              <AboutForm
                initial={{
                  sectionKey: section.sectionKey,
                  title: section.title,
                  body: section.body,
                  sortOrder: section.sortOrder,
                }}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
