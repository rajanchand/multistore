import { Suspense } from 'react';
import AccountClient from './account-client';

export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md px-4 py-10">
          <p className="text-sm text-[var(--nm-muted)]">Loading account…</p>
        </div>
      }
    >
      <AccountClient />
    </Suspense>
  );
}
