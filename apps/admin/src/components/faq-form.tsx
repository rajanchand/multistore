'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input } from '@repo/ui';
import { API_URL } from '@/lib/api';

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function FaqForm() {
  const router = useRouter();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [category, setCategory] = useState('General');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const token = readCookie('admin_session');
    if (!token) {
      setError('Session expired');
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/v1/faqs`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question, answer, category, isPublished: true }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error?.message ?? 'Failed to create FAQ');
        return;
      }
      setQuestion('');
      setAnswer('');
      router.refresh();
    } catch {
      setError('Unable to reach the API');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
      <label className="space-y-1.5 text-sm md:col-span-2">
        <span className="font-medium">Question</span>
        <Input value={question} onChange={(e) => setQuestion(e.target.value)} required />
      </label>
      <label className="space-y-1.5 text-sm md:col-span-2">
        <span className="font-medium">Answer</span>
        <textarea
          className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          required
        />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="font-medium">Category</span>
        <Input value={category} onChange={(e) => setCategory(e.target.value)} />
      </label>
      <div className="flex items-end">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving…' : 'Add FAQ'}
        </Button>
      </div>
      {error && <p className="md:col-span-2 text-sm text-destructive">{error}</p>}
    </form>
  );
}
