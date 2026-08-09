'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input } from '@repo/ui';
import { API_URL } from '@/lib/api';

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function ProfileDetailsForm({
  initial,
}: {
  initial: {
    firstName: string;
    lastName: string;
    username: string;
    email: string;
  };
}) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [username, setUsername] = useState(initial.username);
  const [email, setEmail] = useState(initial.email);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);
    const token = readCookie('admin_session');
    if (!token) {
      setError('Session expired');
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/profile`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ firstName, lastName, username, email }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message ?? 'Failed to update profile');
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError('Unable to reach the API');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
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
        <Input value={username} onChange={(e) => setUsername(e.target.value)} required />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="font-medium">Email</span>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <div className="flex items-center gap-3 md:col-span-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving…' : 'Save profile'}
        </Button>
        {saved && <p className="text-sm text-emerald-700">Saved</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </form>
  );
}

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    setLoading(true);
    const token = readCookie('admin_session');
    if (!token) {
      setError('Session expired');
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/change-password`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message ?? 'Failed to change password');
        return;
      }
      setMessage(data?.message ?? 'Password changed');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setError('Unable to reach the API');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-md gap-3">
      <label className="space-y-1.5 text-sm">
        <span className="font-medium">Current password</span>
        <Input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="font-medium">New password</span>
        <Input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          autoComplete="new-password"
        />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="font-medium">Confirm new password</span>
        <Input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
        />
      </label>
      <p className="text-xs text-muted-foreground">
        At least 10 characters, mixing lower case with upper case or digits. Other sessions will be
        signed out.
      </p>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? 'Updating…' : 'Change password'}
        </Button>
        {message && <p className="text-sm text-emerald-700">{message}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </form>
  );
}
