import Link from 'next/link';
import { cookies } from 'next/headers';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api, ApiError } from '@/lib/api';
import { ChangePasswordForm, ProfileDetailsForm } from '@/components/profile-forms';

type Profile = {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  isGlobal: boolean;
  mfaEnabled: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  permissions: string[];
  roles: Array<{ role: { id: string; name: string; description?: string | null } }>;
  branches: Array<{ branch: { id: string; name: string; code: string } }>;
};

export default async function ProfilePage() {
  const token = cookies().get('admin_session')?.value;
  const headers: Record<string, string> | undefined = token
    ? { Cookie: `admin_session=${token}` }
    : undefined;

  let profile: Profile | null = null;
  let error: string | null = null;
  try {
    profile = await api<Profile>('/auth/me', { token, cache: 'no-store', headers });
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load profile';
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My profile</h1>
        <p className="text-sm text-muted-foreground">
          Update your account details and password
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {profile && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Account overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-lg font-medium">
                  {profile.firstName} {profile.lastName}
                </p>
                <Badge variant={profile.isActive ? 'success' : 'secondary'}>
                  {profile.isActive ? 'Active' : 'Disabled'}
                </Badge>
                {profile.mfaEnabled && <Badge variant="outline">MFA on</Badge>}
                {profile.isGlobal && <Badge variant="outline">HQ / global</Badge>}
              </div>
              <p className="text-muted-foreground">
                @{profile.username} · {profile.email}
              </p>
              <p className="text-muted-foreground">
                Roles: {profile.roles.map((r) => r.role.name).join(', ') || '—'}
              </p>
              <p className="text-muted-foreground">
                Branches:{' '}
                {profile.isGlobal
                  ? 'All (HQ)'
                  : profile.branches.map((b) => b.branch.code).join(', ') || '—'}
              </p>
              <p className="text-muted-foreground">
                Last login:{' '}
                {profile.lastLoginAt
                  ? new Date(profile.lastLoginAt).toLocaleString('en-GB')
                  : '—'}
              </p>
              <p>
                <Link href="/sessions" className="underline">
                  Manage login sessions
                </Link>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Profile details</CardTitle>
            </CardHeader>
            <CardContent>
              <ProfileDetailsForm
                initial={{
                  firstName: profile.firstName,
                  lastName: profile.lastName,
                  username: profile.username,
                  email: profile.email,
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Change password</CardTitle>
            </CardHeader>
            <CardContent>
              <ChangePasswordForm />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
