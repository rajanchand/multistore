'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { API_URL } from '@/lib/api';
import { getPreferredBranchCookie, setPreferredBranchCookie } from '@/lib/branch-cookie';
import { readCartToken } from '@/lib/cart-cookie';
import { switchCartBranchViaProxy } from '@/lib/cart-api';

interface Branch {
  id: string;
  name: string;
  slug: string;
  city: string;
}

export function BranchSelector() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selected, setSelected] = useState('');
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    const current = getPreferredBranchCookie();
    if (current) setSelected(current);
    fetch(`${API_URL}/api/v1/storefront/branches`)
      .then((r) => r.json())
      .then((data: Branch[]) => {
        if (Array.isArray(data)) setBranches(data);
      })
      .catch(() => undefined);
  }, []);

  async function onChange(id: string) {
    if (!id || id === selected || switching) return;
    setSwitching(true);
    setSelected(id);
    setPreferredBranchCookie(id);

    const cartToken = readCartToken();
    if (cartToken) {
      try {
        await switchCartBranchViaProxy(cartToken, id);
      } catch {
        /* reload will still apply preferred_branch pricing on next cart create */
      }
    }

    window.dispatchEvent(new CustomEvent('branch-changed', { detail: { branchId: id } }));
    window.location.reload();
  }

  if (!selected) {
    return (
      <Link
        href="/select-location"
        className="inline-flex h-11 max-w-[11rem] items-center rounded-xl border border-[var(--nm-line)] bg-white px-3 text-sm font-semibold text-[var(--nm-accent)]"
      >
        Choose store
      </Link>
    );
  }

  return (
    <select
      aria-label="Select branch"
      className="h-11 max-w-[11rem] rounded-xl border border-[var(--nm-line)] bg-white px-2 text-sm font-medium text-[var(--nm-ink)]"
      value={selected}
      disabled={switching}
      onChange={(e) => void onChange(e.target.value)}
    >
      {branches.map((b) => (
        <option key={b.id} value={b.id}>
          {b.city}
        </option>
      ))}
    </select>
  );
}
