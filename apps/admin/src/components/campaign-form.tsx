'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent, Input } from '@repo/ui';
import { API_URL } from '@/lib/api';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200);
}

export function CampaignForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [channel, setChannel] = useState('MULTI');
  const [status, setStatus] = useState('DRAFT');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/campaigns`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          slug: slug || slugify(name),
          description: description || undefined,
          channel,
          status,
          content: { subject: subject || undefined, body: body || undefined },
          branchIds: [],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? 'Failed to create campaign');
        return;
      }
      router.push(`/campaigns/${data.id}`);
      router.refresh();
    } catch {
      setError('Unable to reach the API');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm sm:col-span-2">
            <span className="font-medium">Name</span>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug || slug === slugify(name)) setSlug(slugify(e.target.value));
              }}
              required
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Slug</span>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} required />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Channel</span>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
            >
              {['MULTI', 'EMAIL', 'SMS', 'IN_APP', 'BANNER'].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Status</span>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {['DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED'].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 text-sm sm:col-span-2">
            <span className="font-medium">Description</span>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label className="space-y-1.5 text-sm sm:col-span-2">
            <span className="font-medium">Subject</span>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <label className="space-y-1.5 text-sm sm:col-span-2">
            <span className="font-medium">Body</span>
            <textarea
              className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          {error && <p className="sm:col-span-2 text-sm text-destructive">{error}</p>}
          <div className="sm:col-span-2 flex gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating…' : 'Create campaign'}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push('/campaigns')}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
