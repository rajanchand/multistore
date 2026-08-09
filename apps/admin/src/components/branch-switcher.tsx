'use client';

import { useRouter } from 'next/navigation';
import { Building2 } from 'lucide-react';

const COOKIE = 'admin_branch_id';

export function BranchSwitcher({
  branches,
  selectedId,
}: {
  branches: Array<{ id: string; name: string; code: string }>;
  selectedId: string | null;
}) {
  const router = useRouter();

  function select(id: string) {
    const maxAge = 60 * 60 * 24 * 30;
    document.cookie = `${COOKIE}=${encodeURIComponent(id)}; path=/; max-age=${maxAge}; samesite=lax`;
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Building2 className="hidden h-4 w-4 text-muted-foreground sm:block" />
      <div className="flex max-w-[min(100vw-12rem,36rem)] items-center gap-1 overflow-x-auto pb-0.5">
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
