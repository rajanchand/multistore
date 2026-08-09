'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { API_URL } from '@/lib/api';
import { BRANCH_COOKIE, getPreferredBranchCookie, setPreferredBranchCookie } from '@/lib/branch-cookie';

interface Branch {
  id: string;
  name: string;
  slug: string;
  city: string;
}

export function BranchSelector() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selected, setSelected] = useState('');

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

  function onChange(id: string) {
    if (!id) return;
    setSelected(id);
    setPreferredBranchCookie(id);
    window.dispatchEvent(new CustomEvent('branch-changed', { detail: { branchId: id } }));
    window.location.reload();
  }

  if (!selected) {
    return (
      <Link
        href="/select-location"
        className="inline-flex h-10 max-w-[11rem] items-center rounded-full border border-emerald-900/10 bg-white px-3 text-sm font-medium text-[var(--nm-forest)]"
      >
        Choose store
      </Link>
    );
  }

  return (
    <select
      aria-label="Select branch"
      className="h-10 max-w-[11rem] rounded-full border border-emerald-900/10 bg-white px-2 text-sm"
      value={selected}
      onChange={(e) => onChange(e.target.value)}
    >
      {branches.map((b) => (
        <option key={b.id} value={b.id}>
          {b.city}
        </option>
      ))}
    </select>
  );
}

export function getPreferredBranchId(): string | null {
  return getPreferredBranchCookie();
}

export { BRANCH_COOKIE };
