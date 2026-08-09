import Link from 'next/link';
import { cookies } from 'next/headers';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api, ApiError } from '@/lib/api';
import { PaymentMethodToggle } from '@/components/payment-method-toggle';

type IntegrationStatus = {
  stripe: {
    configured: boolean;
    mode: string;
    publishableKeyConfigured: boolean;
    publishableKeyHint: string | null;
    webhookConfigured: boolean;
    envVars: string[];
  };
  wallets: {
    applePay: { via: string; setup: string[]; docsUrl: string };
    googlePay: { via: string; setup: string[]; docsUrl: string };
  };
  docs: { stripe: string; webhooks: string };
};

export default async function SettingsPaymentMethodsPage() {
  const token = cookies().get('admin_session')?.value;
  const headers: Record<string, string> | undefined = token
    ? { Cookie: `admin_session=${token}` }
    : undefined;

  let methods: Array<{
    id: string;
    code: string;
    name: string;
    description?: string | null;
    provider: string;
    isEnabled: boolean;
    sortOrder: number;
  }> = [];
  let integration: IntegrationStatus | null = null;
  let error: string | null = null;

  try {
    [methods, integration] = await Promise.all([
      api<typeof methods>('/payment-methods?includeDisabled=true', {
        token,
        cache: 'no-store',
        headers,
      }),
      api<IntegrationStatus>('/settings/payments/integration', {
        token,
        cache: 'no-store',
        headers,
      }),
    ]);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load payment methods';
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/settings" className="hover:underline">
            Settings
          </Link>{' '}
          / Payment methods
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Payment methods</h1>
        <p className="text-sm text-muted-foreground">
          Stripe powers cards, Apple Pay and Google Pay. Secrets stay in environment variables.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {integration && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stripe</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                Status:{' '}
                <Badge variant={integration.stripe.configured ? 'success' : 'secondary'}>
                  {integration.stripe.configured
                    ? `Connected (${integration.stripe.mode})`
                    : 'Not configured'}
                </Badge>
              </p>
              <p className="text-muted-foreground">
                Publishable key:{' '}
                {integration.stripe.publishableKeyConfigured
                  ? integration.stripe.publishableKeyHint
                  : 'missing'}
              </p>
              <p className="text-muted-foreground">
                Webhook secret:{' '}
                {integration.stripe.webhookConfigured ? 'set' : 'missing'}
              </p>
              <p className="text-xs text-muted-foreground">
                Set {integration.stripe.envVars.join(', ')} then restart the API.
              </p>
              <a
                href={integration.docs.stripe}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-sm underline"
              >
                Stripe Payment Element docs
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Apple Pay</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Via Stripe wallets — no separate Apple developer key in this app.</p>
              <ol className="list-decimal space-y-1 pl-4">
                {integration.wallets.applePay.setup.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <a
                href={integration.wallets.applePay.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-sm text-foreground underline"
              >
                Apple Pay + Stripe guide
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Google Pay</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Via Stripe automatic payment methods / Payment Element.</p>
              <ol className="list-decimal space-y-1 pl-4">
                {integration.wallets.googlePay.setup.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <a
                href={integration.wallets.googlePay.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-sm text-foreground underline"
              >
                Google Pay + Stripe guide
              </a>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Checkout methods ({methods.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Code</th>
                <th className="pb-2 font-medium">Provider</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {methods.map((m) => (
                <tr key={m.id} className="border-b last:border-0">
                  <td className="py-3">
                    <p className="font-medium">{m.name}</p>
                    {m.description && (
                      <p className="text-xs text-muted-foreground">{m.description}</p>
                    )}
                  </td>
                  <td className="py-3 font-mono text-xs">{m.code}</td>
                  <td className="py-3">{m.provider}</td>
                  <td className="py-3">
                    <Badge variant={m.isEnabled ? 'success' : 'secondary'}>
                      {m.isEnabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </td>
                  <td className="py-3">
                    <PaymentMethodToggle id={m.id} isEnabled={m.isEnabled} />
                  </td>
                </tr>
              ))}
              {!error && methods.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No payment methods configured
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
