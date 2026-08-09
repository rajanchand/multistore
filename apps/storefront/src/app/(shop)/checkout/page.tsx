import Link from 'next/link';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { getCustomerSession } from '@/lib/auth';

export default async function CheckoutPage() {
  const customer = await getCustomerSession();

  if (!customer) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="font-[Fraunces] text-4xl font-semibold">Checkout</h1>
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-600">
            <p>
              Checkout creates a server-side order, reserves stock atomically, and opens a Stripe
              PaymentIntent. You must be signed in as a customer before payment.
            </p>
            <p>Dev customer: alice@example.dev / DevPassword123!</p>
            <div className="flex gap-3">
              <Button asChild>
                <Link href="/account">Sign in</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/cart">Back to cart</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-[Fraunces] text-4xl font-semibold">Checkout</h1>
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Ready to pay</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-600">
          <p>
            Signed in as {customer.firstName} {customer.lastName} ({customer.email}). Complete
            payment from your cart when Stripe checkout is wired for this branch.
          </p>
          <div className="flex gap-3">
            <Button asChild>
              <Link href="/cart">Review cart</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/account">Account</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
