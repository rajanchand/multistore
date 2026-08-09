'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input } from '@repo/ui';
import { API_URL } from '@/lib/api';

export type StaffRole = { id: string; name: string; description?: string | null };
export type StaffBranch = { id: string; name: string; code: string };

export type StaffUserInitial = {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  isGlobal: boolean;
  roles: Array<{ role: { id: string; name: string } }>;
  branches: Array<{ branch: { id: string; name: string; code: string } }>;
};

export function StaffUserForm({
  mode,
  roles,
  branches,
  initial,
  actorIsGlobal = true,
}: {
  mode: 'create' | 'edit';
  roles: StaffRole[];
  branches: StaffBranch[];
  initial?: StaffUserInitial;
  /** When false, HQ/global scope cannot be granted and branch picker is limited. */
  actorIsGlobal?: boolean;
}) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(initial?.firstName ?? '');
  const [lastName, setLastName] = useState(initial?.lastName ?? '');
  const [username, setUsername] = useState(initial?.username ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [password, setPassword] = useState('');
  const [roleIds, setRoleIds] = useState<string[]>(
    initial?.roles.map((r) => r.role.id) ?? (roles[0] ? [roles[0].id] : []),
  );
  const [isGlobal, setIsGlobal] = useState(
    actorIsGlobal ? (initial?.isGlobal ?? false) : false,
  );
  const [branchIds, setBranchIds] = useState<string[]>(() => {
    const initialIds = initial?.branches.map((b) => b.branch.id) ?? [];
    if (initialIds.length > 0) return initialIds;
    // Branch admins default new staff to their only assignable branch.
    if (!actorIsGlobal && branches.length === 1) return [branches[0]!.id];
    return [];
  });
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedRoleNames = useMemo(
    () => roles.filter((r) => roleIds.includes(r.id)).map((r) => r.name),
    [roles, roleIds],
  );

  function toggleRole(id: string) {
    setRoleIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleBranch(id: string) {
    setBranchIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    if (roleIds.length === 0) {
      setError('Select at least one role');
      setLoading(false);
      return;
    }
    if (!isGlobal && branchIds.length === 0) {
      setError('Select at least one branch, or enable HQ access');
      setLoading(false);
      return;
    }

    const body: Record<string, unknown> = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      username: username.trim().toLowerCase(),
      email: email.trim().toLowerCase(),
      roleIds,
      isGlobal,
      branchIds: isGlobal ? [] : branchIds,
      isActive,
    };
    if (mode === 'create') body.password = password;

    try {
      const res = await fetch(
        `${API_URL}/api/v1/users${mode === 'edit' ? `/${initial?.id}` : ''}`,
        {
          method: mode === 'edit' ? 'PATCH' : 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message ?? 'Failed to save staff user');
        return;
      }
      router.push(`/users/${data.id}`);
      router.refresh();
    } catch {
      setError('Unable to reach the API');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
      <label className="space-y-1.5 text-sm">
        <span className="font-medium">First name</span>
        <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="font-medium">Last name</span>
        <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="font-medium">Username</span>
        <Input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          pattern="[a-zA-Z0-9._-]{3,40}"
          placeholder="e.g. jane.manager"
        />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="font-medium">Email address</span>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      {mode === 'create' && (
        <label className="space-y-1.5 text-sm md:col-span-2">
          <span className="font-medium">Password</span>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={10}
            placeholder="Min 10 chars, mix lower + upper/digits"
          />
        </label>
      )}

      <div className="space-y-2 text-sm md:col-span-2">
        <p className="font-medium">Roles</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => (
            <label
              key={role.id}
              className="flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2"
            >
              <input
                type="checkbox"
                className="mt-1"
                checked={roleIds.includes(role.id)}
                onChange={() => toggleRole(role.id)}
              />
              <span>
                <span className="font-medium">{role.name}</span>
                {role.description && (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {role.description}
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
        {selectedRoleNames.length > 0 && (
          <p className="text-xs text-muted-foreground">Selected: {selectedRoleNames.join(', ')}</p>
        )}
      </div>

      {actorIsGlobal ? (
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input
            type="checkbox"
            checked={isGlobal}
            onChange={(e) => setIsGlobal(e.target.checked)}
          />
          <span className="font-medium">HQ access (all branches)</span>
        </label>
      ) : (
        <p className="text-sm text-muted-foreground md:col-span-2">
          Staff you create are limited to your assigned branch(es).
        </p>
      )}

      {!isGlobal && (
        <div className="space-y-2 text-sm md:col-span-2">
          <p className="font-medium">Branches</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {branches.map((b) => (
              <label
                key={b.id}
                className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2"
              >
                <input
                  type="checkbox"
                  checked={branchIds.includes(b.id)}
                  onChange={() => toggleBranch(b.id)}
                />
                <span>
                  {b.name}{' '}
                  <span className="font-mono text-xs text-muted-foreground">{b.code}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm md:col-span-2">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
        <span className="font-medium">Active status</span>
      </label>

      <div className="flex items-center gap-3 md:col-span-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving…' : mode === 'create' ? 'Create staff user' : 'Save changes'}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </form>
  );
}
