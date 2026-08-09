'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { MapPin, Navigation, Store } from 'lucide-react';
import { API_URL } from '@/lib/api';
import { setPreferredBranchCookie } from '@/lib/branch-cookie';

interface BranchOption {
  id: string;
  name: string;
  slug: string;
  city: string;
  postcode: string;
  addressLine1?: string;
  distanceKm?: number | null;
  deliveryEnabled?: boolean;
  clickCollectEnabled?: boolean;
}

interface NearestResponse {
  postcode: string;
  nearest: BranchOption;
  alternatives: BranchOption[];
}

export function LocationGate({ nextPath = '/' }: { nextPath?: string }) {
  const [postcode, setPostcode] = useState('');
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [suggested, setSuggested] = useState<BranchOption | null>(null);
  const [alternatives, setAlternatives] = useState<BranchOption[]>([]);
  const [resolvedPostcode, setResolvedPostcode] = useState<string | null>(null);
  const [mode, setMode] = useState<'find' | 'confirm'>('find');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/storefront/branches`)
      .then((r) => r.json())
      .then((data: BranchOption[]) => {
        if (Array.isArray(data)) setBranches(data);
      })
      .catch(() => undefined);
  }, []);

  const destination = useMemo(() => {
    if (!nextPath || nextPath.startsWith('//') || nextPath.includes('://')) return '/';
    return nextPath.startsWith('/') ? nextPath : '/';
  }, [nextPath]);

  async function findByPostcode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/api/v1/storefront/branches/nearest?postcode=${encodeURIComponent(postcode.trim())}`,
      );
      const data = (await res.json()) as NearestResponse & { message?: string };
      if (!res.ok) {
        setError(data.message ?? 'We could not match that postcode. Try again or pick a store.');
        return;
      }
      setSuggested(data.nearest);
      setAlternatives(data.alternatives ?? []);
      setResolvedPostcode(data.postcode);
      setMode('confirm');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function chooseBranch(branch: BranchOption) {
    setSuggested(branch);
    setMode('confirm');
    setError(null);
  }

  function confirmAndEnter() {
    if (!suggested) return;
    setPreferredBranchCookie(suggested.id);
    window.dispatchEvent(new CustomEvent('branch-changed', { detail: { branchId: suggested.id } }));
    window.location.assign(destination);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="nm-animate-in relative w-full max-w-xl">
        <p className="font-display text-center text-4xl font-bold tracking-tight text-[var(--nm-ink)] sm:text-5xl">
          Neighbourhood
          <span className="text-[var(--nm-accent)]"> Market</span>
        </p>

        {mode === 'find' ? (
          <div className="mt-8 border-t border-[var(--nm-line)] bg-white/70 px-1 py-8 backdrop-blur sm:px-2">
            <h1 className="text-xl font-semibold text-[var(--nm-ink)] sm:text-2xl">
              Choose your store
            </h1>
            <p className="mt-2 text-sm text-[var(--nm-muted)]">
              Enter your postcode or pick a branch for local prices and stock.
            </p>

            <form onSubmit={findByPostcode} className="mt-6 space-y-3">
              <label className="block text-sm font-medium text-[var(--nm-ink)]" htmlFor="postcode">
                Postal code
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Navigation className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--nm-muted)]" />
                  <input
                    id="postcode"
                    name="postcode"
                    autoComplete="postal-code"
                    inputMode="text"
                    placeholder="e.g. G1 1AA"
                    value={postcode}
                    onChange={(e) => setPostcode(e.target.value)}
                    className="h-12 w-full rounded-xl border border-[var(--nm-line)] bg-white pl-10 pr-3 text-base outline-none ring-[var(--nm-accent)]/25 focus:ring-2"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !postcode.trim()}
                  className="h-12 rounded-xl bg-[var(--nm-accent)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--nm-accent-hover)] disabled:opacity-60"
                >
                  {loading ? 'Finding…' : 'Find nearest'}
                </button>
              </div>
            </form>

            {error && (
              <p className="mt-3 text-sm text-red-700" role="alert">
                {error}
              </p>
            )}

            <div className="mt-8">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[var(--nm-ink)]">
                <Store className="h-4 w-4 text-[var(--nm-accent)]" />
                Or choose a location
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {branches.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => chooseBranch(b)}
                      className="flex min-h-[48px] w-full items-start gap-3 rounded-xl border border-[var(--nm-line)] bg-[var(--nm-soft)]/50 px-3 py-3 text-left transition hover:border-[var(--nm-accent)]/40 hover:bg-white"
                    >
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--nm-accent)]" />
                      <span>
                        <span className="block text-sm font-semibold text-[var(--nm-ink)]">{b.name}</span>
                        <span className="block text-xs text-[var(--nm-muted)]">
                          {b.city} · {b.postcode}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-6 text-center text-xs text-[var(--nm-muted)]">
              <Link href="/privacy" className="underline-offset-2 hover:underline">
                Privacy
              </Link>
              {' · '}
              <Link href="/terms" className="underline-offset-2 hover:underline">
                Terms
              </Link>
            </p>
          </div>
        ) : (
          <div className="nm-animate-in-delay mt-8 border-t border-[var(--nm-line)] bg-white/70 px-1 py-8 backdrop-blur sm:px-2">
            <p className="text-sm font-semibold text-[var(--nm-accent)]">Your store</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--nm-ink)] sm:text-3xl">
              Welcome to {suggested?.name}
            </h1>
            <p className="mt-3 text-[var(--nm-muted)]">
              {suggested?.addressLine1 ? `${suggested.addressLine1}, ` : ''}
              {suggested?.city}
              {suggested?.postcode ? ` · ${suggested.postcode}` : ''}
              {resolvedPostcode ? (
                <span className="block text-sm">Matched from {resolvedPostcode}</span>
              ) : null}
              {suggested?.distanceKm != null ? (
                <span className="mt-1 block text-sm">About {suggested.distanceKm} km away</span>
              ) : null}
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={confirmAndEnter}
                className="h-12 flex-1 rounded-xl bg-[var(--nm-accent)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--nm-accent-hover)]"
              >
                Continue shopping
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('find');
                  setSuggested(null);
                  setResolvedPostcode(null);
                }}
                className="h-12 rounded-xl border border-[var(--nm-line)] bg-white px-5 text-sm font-semibold text-[var(--nm-ink)] transition hover:bg-[var(--nm-soft)]"
              >
                Choose a different store
              </button>
            </div>

            {alternatives.length > 1 && (
              <div className="mt-8">
                <p className="mb-2 text-sm font-medium text-[var(--nm-ink)]">Other nearby options</p>
                <ul className="space-y-2">
                  {alternatives
                    .filter((b) => b.id !== suggested?.id)
                    .map((b) => (
                      <li key={b.id}>
                        <button
                          type="button"
                          onClick={() => setSuggested(b)}
                          className="flex min-h-[44px] w-full items-center justify-between rounded-xl border border-transparent px-3 py-2 text-left text-sm hover:border-[var(--nm-line)] hover:bg-[var(--nm-soft)]/60"
                        >
                          <span>
                            <span className="font-medium text-[var(--nm-ink)]">{b.name}</span>
                            <span className="ml-2 text-[var(--nm-muted)]">{b.city}</span>
                          </span>
                          {b.distanceKm != null && (
                            <span className="text-xs text-[var(--nm-muted)]">{b.distanceKm} km</span>
                          )}
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
