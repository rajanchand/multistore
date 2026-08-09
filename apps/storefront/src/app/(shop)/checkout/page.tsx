import Link from 'next/link';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { CheckoutFlow } from '@/components/checkout-flow';
import { getCustomerSession } from '@/lib/auth';

export default async function CheckoutPage() {
  const customer = await getCustomerSession();

  if (!customer) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="font-display text-4xl font-bold tracking-tight text-[var(--nm-ink)]">
          Checkout
        </h1>
        <Card className="mt-8 border-[var(--nm-line)] bg-[var(--nm-surface)]">
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-[var(--nm-muted)]">
            <p>
              Checkout creates a server-side order, reserves stock atomically, and opens a Stripe
              PaymentIntent. Sign in as a customer before payment.
            </p>
            <div className="flex gap-3">
              <Button asChild className="rounded-xl">
                <Link href="/account">Sign in</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/cart">Back to cart</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <CheckoutFlow
      customer={{
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
      }}
    />
  );
}
