'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2 } from 'lucide-react';

const COOKIE = 'admin_branch_id';

function setBranchCookie(id: string) {
  const maxAge = 60 * 60 * 24 * 30;
  document.cookie = `${COOKIE}=${encodeURIComponent(id)}; path=/; max-age=${maxAge}; samesite=lax`;
}

export function BranchSwitcher({
  branches,
  selectedId,
  isGlobal = false,
}: {
  branches: Array<{ id: string; name: string; code: string }>;
  selectedId: string | null;
  /** HQ users may view all branches; branch staff are locked to assigned stores. */
  isGlobal?: boolean;
}) {
  const router = useRouter();
  const singleBranch = !isGlobal && branches.length === 1 ? branches[0] : null;

  // Auto-pin branch-scoped staff to their only (or first) assigned branch.
  useEffect(() => {
    if (isGlobal || branches.length === 0) return;
    if (selectedId && branches.some((b) => b.id === selectedId)) return;
    const fallback = singleBranch ?? branches[0];
    if (!fallback) return;
    setBranchCookie(fallback.id);
    router.refresh();
  }, [isGlobal, branches, selectedId, singleBranch, router]);

  function select(id: string) {
    setBranchCookie(id);
    router.refresh();
  }

  if (singleBranch) {
    return (
      <div className="flex items-center gap-2">
        <Building2 className="hidden h-4 w-4 text-muted-foreground sm:block" />
        <span
          className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
          title={singleBranch.name}
        >
          {singleBranch.code}
        </span>
        <span className="hidden text-sm text-muted-foreground sm:inline">{singleBranch.name}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Building2 className="hidden h-4 w-4 text-muted-foreground sm:block" />
      <div className="flex max-w-[min(100vw-12rem,36rem)] items-center gap-1 overflow-x-auto pb-0.5">
        {isGlobal && (
          <button
            type="button"
            onClick={() => select('all')}
            className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition ${
              !selectedId
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            All branches
          </button>
        )}
        {branches.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => select(b.id)}
            title={b.name}
            className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition ${
              selectedId === b.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            {b.code}
          </button>
        ))}
      </div>
    </div>
  );
}
