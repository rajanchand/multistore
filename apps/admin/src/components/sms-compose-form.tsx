'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent, Input } from '@repo/ui';
import { API_URL } from '@/lib/api';

type Branch = { id: string; name: string; code: string };
type Campaign = {
  id: string;
  name: string;
  status: string;
  audience?: { segment?: string } | null;
  branches?: Array<{ branch: Branch }>;
};
type Offer = {
  id: string;
  name: string;
  type: string;
  value: number;
  status: string;
  description?: string | null;
  coupons?: Array<{ code: string; isActive: boolean }>;
};

export function SmsComposeForm({
  branches,
  campaigns,
  offers,
}: {
  branches: Branch[];
  campaigns: Campaign[];
  offers: Offer[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'single' | 'bulk'>('bulk');
  const [toPhone, setToPhone] = useState('');
  const [body, setBody] = useState('');
  const [segment, setSegment] = useState('marketing_opt_in');
  const [branchId, setBranchId] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [promotionId, setPromotionId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genMeta, setGenMeta] = useState<string | null>(null);
  const [geminiStatus, setGeminiStatus] = useState<{
    configured: boolean;
    smsModel?: string;
    message?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    function readCookie(name: string): string | null {
      const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
      return match?.[1] ? decodeURIComponent(match[1]) : null;
    }
    async function loadGemini() {
      try {
        const token = readCookie('admin_session');
        const res = await fetch(`${API_URL}/api/v1/sms/gemini-status`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: 'include',
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          configured?: boolean;
          smsModel?: string;
          message?: string;
        };
        if (!cancelled) {
          setGeminiStatus({
            configured: Boolean(data.configured),
            smsModel: data.smsModel,
            message: data.message,
          });
        }
      } catch {
        /* keep null — UI falls back to generic hint */
      }
    }
    void loadGemini();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedOffer = useMemo(
    () => offers.find((o) => o.id === promotionId) ?? null,
    [offers, promotionId],
  );

  useEffect(() => {
    if (!campaignId) return;
    const campaign = campaigns.find((c) => c.id === campaignId);
    if (!campaign) return;
    const audienceSegment = campaign.audience?.segment;
    if (audienceSegment) {
      setSegment(audienceSegment);
      setMode('bulk');
    }
    const linkedBranch = campaign.branches?.[0]?.branch?.id;
    if (linkedBranch && branches.some((b) => b.id === linkedBranch)) {
      setBranchId(linkedBranch);
    }
  }, [campaignId, campaigns, branches]);

  function authHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
    };
  }

  async function generateMessage(nextPromotionId = promotionId) {
    setGenerating(true);
    setError(null);
    setGenMeta(null);
    const headers = authHeaders();

    try {
      const res = await fetch(`${API_URL}/api/v1/sms/generate`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          mode,
          campaignId: campaignId || undefined,
          segment: mode === 'bulk' ? segment : undefined,
          branchId: branchId || undefined,
          promotionId: nextPromotionId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? 'Could not generate message');
        return;
      }
      setBody(data.body ?? '');
      const via = data.provider === 'gemini' ? `Gemini${data.model ? ` (${data.model})` : ''}` : 'template fallback';
      setGenMeta(`Message generated via ${via}`);
    } catch {
      setError('Unable to reach the API');
    } finally {
      setGenerating(false);
    }
  }

  async function onOfferChange(nextId: string) {
    setPromotionId(nextId);
    if (nextId) {
      await generateMessage(nextId);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    const headers = authHeaders();
    const payload =
      mode === 'single'
        ? {
            toPhone,
            body,
            campaignId: campaignId || undefined,
            branchId: branchId || undefined,
          }
        : {
            body,
            segment,
            branchId: segment === 'branch_customers' ? branchId : branchId || undefined,
            campaignId: campaignId || undefined,
          };

    try {
      const res = await fetch(`${API_URL}/api/v1/sms/send`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? 'Send failed');
        return;
      }
      setResult(`Queued ${data.queued} message(s)${data.batchId ? ` · batch ${data.batchId}` : ''}`);
      setBody('');
      setGenMeta(null);
      router.refresh();
    } catch {
      setError('Unable to reach the API');
    } finally {
      setLoading(false);
    }
  }

  function offerLabel(o: Offer): string {
    const coupon = o.coupons?.find((c) => c.isActive)?.code;
    const suffix = coupon ? ` · ${coupon}` : '';
    return `${o.name} (${o.status})${suffix}`;
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Mode</span>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={mode}
              onChange={(e) => setMode(e.target.value as 'single' | 'bulk')}
            >
              <option value="single">Individual</option>
              <option value="bulk">Bulk segment</option>
            </select>
          </label>

          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Campaign</span>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
            >
              <option value="">None</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.status})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5 text-sm sm:col-span-2">
            <span className="font-medium">Offer</span>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={promotionId}
              onChange={(e) => void onOfferChange(e.target.value)}
            >
              <option value="">Select offer to auto-write message…</option>
              {offers.map((o) => (
                <option key={o.id} value={o.id}>
                  {offerLabel(o)}
                </option>
              ))}
            </select>
            {selectedOffer?.description && (
              <span className="block text-xs text-muted-foreground">{selectedOffer.description}</span>
            )}
          </label>

          {mode === 'single' ? (
            <>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">To phone</span>
                <Input
                  value={toPhone}
                  onChange={(e) => setToPhone(e.target.value)}
                  placeholder="+447700900123"
                  required
                />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Branch (optional)</span>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Segment</span>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={segment}
                  onChange={(e) => setSegment(e.target.value)}
                >
                  <option value="marketing_opt_in">Marketing opt-in</option>
                  <option value="all_customers">All customers with phone</option>
                  <option value="branch_customers">Branch customers</option>
                </select>
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Branch</span>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  required={segment === 'branch_customers'}
                >
                  <option value="">Select…</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          <label className="space-y-1.5 text-sm sm:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">Message</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={generating}
                onClick={() => void generateMessage()}
              >
                {generating ? 'Generating…' : 'Generate with AI'}
              </Button>
            </div>
            <textarea
              className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={1600}
              required
              placeholder="Select an offer to auto-generate, or write your own…"
            />
            <span className="flex justify-between gap-3 text-xs text-muted-foreground">
              <span>
                {genMeta ??
                  (geminiStatus
                    ? geminiStatus.configured
                      ? `Gemini ready (${geminiStatus.smsModel}). Generate with AI uses the live model.`
                      : 'Gemini key missing — using template fallback. Set GEMINI_API_KEY in API .env and restart.'
                    : 'Uses Google Gemini when GEMINI_API_KEY is set on the API.')}
              </span>
              <span>
                {body.length}/1600
              </span>
            </span>
            {geminiStatus && !geminiStatus.configured && (
              <p className="rounded-md border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                Get a key at{' '}
                <a
                  className="font-medium underline"
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noreferrer"
                >
                  aistudio.google.com/apikey
                </a>
                , add <code className="rounded bg-amber-100 px-1">GEMINI_API_KEY=…</code> to{' '}
                <code className="rounded bg-amber-100 px-1">.env</code>, then restart the API.
              </p>
            )}
          </label>

          {error && <p className="sm:col-span-2 text-sm text-destructive">{error}</p>}
          {result && <p className="sm:col-span-2 text-sm text-success">{result}</p>}

          <div>
            <Button type="submit" disabled={loading || generating || !body.trim()}>
              {loading ? 'Queueing…' : 'Send SMS'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
