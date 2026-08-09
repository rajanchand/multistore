'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { formatMoney } from '@repo/types';
import { Button, Input } from '@repo/ui';
import { API_URL } from '@/lib/api';

type CustomerInfo = {
  firstName: string;
  lastName: string;
  email: string;
};

type CartView = {
  id: string;
  items: Array<{
    id: string;
    name: string;
    variantName: string;
    quantity: number;
    unitPrice: number;
    problems: string[];
  }>;
  totals: {
    subtotal: number;
    discountTotal: number;
    deliveryFee: number;
    taxTotal: number;
    total: number;
  };
  branch: {
    id: string;
    name: string;
    deliveryEnabled: boolean;
    clickCollectEnabled: boolean;
  };
  hasProblems: boolean;
};

type FulfilmentType = 'DELIVERY' | 'CLICK_AND_COLLECT';
type Step = 'fulfilment' | 'review' | 'pay' | 'done';

type PaymentConfig = {
  configured: boolean;
  publishableKey: string | null;
  message: string | null;
};

type CheckoutResult = {
  orderId: string;
  orderNumber: string;
  total: number;
  currency: string;
  clientSecret: string | null;
  reservationExpiresAt: string;
};

type AddressForm = {
  recipientName: string;
  line1: string;
  line2: string;
  city: string;
  postcode: string;
  phone: string;
};

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function authHeaders(): HeadersInit {
  const token = readCookie('customer_session');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function readApiError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as {
    error?: { code?: string; message?: string };
  } | null;
  if (body?.error?.code === 'PAYMENT_PROVIDER_NOT_CONFIGURED') {
    return (
      body.error.message ??
      'Stripe is not configured. Set STRIPE_* test keys in .env and restart the API.'
    );
  }
  return body?.error?.message ?? res.statusText;
}

const STEPS: Array<{ id: Step; label: string }> = [
  { id: 'fulfilment', label: 'Delivery' },
  { id: 'review', label: 'Review' },
  { id: 'pay', label: 'Pay' },
];

function StepIndicator({ current }: { current: Step }) {
  const activeIndex = STEPS.findIndex((s) => s.id === current);
  return (
    <ol className="mt-6 flex items-center gap-2 text-sm">
      {STEPS.map((step, index) => {
        const done = current === 'done' || index < activeIndex;
        const active = step.id === current;
        return (
          <li key={step.id} className="flex items-center gap-2">
            {index > 0 && <span className="h-px w-6 bg-[var(--nm-line)]" aria-hidden />}
            <span
              className={[
                'inline-flex h-8 items-center rounded-full px-3 font-medium',
                active
                  ? 'bg-[var(--nm-accent)] text-white'
                  : done
                    ? 'bg-[var(--nm-accent-soft)] text-[var(--nm-accent)]'
                    : 'bg-[var(--nm-soft)] text-[var(--nm-muted)]',
              ].join(' ')}
            >
              {index + 1}. {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function StripePayForm({
  orderId,
  orderNumber,
  total,
  currency,
  onPaid,
  onError,
}: {
  orderId: string;
  orderNumber: string;
  total: number;
  currency: string;
  onPaid: (status: string) => void;
  onError: (message: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    onError('');
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
        confirmParams: {
          return_url: `${window.location.origin}/checkout?orderId=${orderId}`,
        },
      });
      if (error) {
        onError(error.message ?? 'Payment failed. Please try again.');
        return;
      }

      // Server verifies with Stripe — never trust client "paid" alone.
      const confirmRes = await fetch(`${API_URL}/api/v1/checkout/orders/${orderId}/confirm`, {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(),
      });
      if (!confirmRes.ok) {
        onError(await readApiError(confirmRes));
        return;
      }
      const confirmed = (await confirmRes.json()) as { status: string };
      if (confirmed.status === 'PAID') {
        onPaid(confirmed.status);
        return;
      }
      // Do not advance to thank-you while the order is not PAID, even if Stripe
      // reports succeeded — webhook/confirm may still be catching up.
      if (paymentIntent?.status === 'succeeded') {
        onError(
          'Payment received but order is still confirming. Wait a moment and try again, or check your orders shortly — status becomes PAID only after server verification.',
        );
        return;
      }
      onError('Payment is still processing. Please wait a moment and try again.');
    } catch {
      onError('Unable to complete payment. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="rounded-2xl border border-[var(--nm-line)] bg-[var(--nm-surface)] p-4">
        <p className="text-sm text-[var(--nm-muted)]">Order {orderNumber}</p>
        <p className="mt-1 text-lg font-semibold text-[var(--nm-ink)]">
          Pay {formatMoney(total, currency)}
        </p>
      </div>
      <div className="rounded-2xl border border-[var(--nm-line)] bg-[var(--nm-surface)] p-4">
        <PaymentElement />
      </div>
      <Button
        type="submit"
        className="h-12 w-full rounded-xl"
        disabled={!stripe || !elements || submitting}
      >
        {submitting ? 'Processing…' : `Pay ${formatMoney(total, currency)}`}
      </Button>
      <p className="text-xs text-[var(--nm-muted)]">
        Card details go to Stripe. This app never stores full card numbers. Orders become PAID only
        after verified server-side confirmation.
      </p>
    </form>
  );
}

export function CheckoutFlow({ customer }: { customer: CustomerInfo }) {
  const [step, setStep] = useState<Step>('fulfilment');
  const [cart, setCart] = useState<CartView | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [fulfilmentType, setFulfilmentType] = useState<FulfilmentType>('CLICK_AND_COLLECT');
  const [contactPhone, setContactPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [address, setAddress] = useState<AddressForm>({
    recipientName: `${customer.firstName} ${customer.lastName}`.trim(),
    line1: '',
    line2: '',
    city: '',
    postcode: '',
    phone: '',
  });

  const [checkout, setCheckout] = useState<CheckoutResult | null>(null);
  const [finalStatus, setFinalStatus] = useState<string | null>(null);
  const [resumingOrder, setResumingOrder] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const params = new URLSearchParams(window.location.search);
        const returnOrderId = params.get('orderId');
        const redirectStatus = params.get('redirect_status');

        const payRes = await fetch(`${API_URL}/api/v1/storefront/payment-config`, {
          credentials: 'include',
        });
        if (payRes.ok) {
          const cfg = (await payRes.json()) as PaymentConfig;
          if (!cancelled) {
            setPaymentConfig(cfg);
            if (cfg.publishableKey) {
              setStripePromise(loadStripe(cfg.publishableKey));
            }
          }
        } else if (!cancelled) {
          setPaymentConfig({
            configured: false,
            publishableKey: null,
            message:
              'Could not load payment configuration. Ensure the API is running and Stripe env vars are set.',
          });
        }

        // Stripe redirect return (3DS / bank redirects): confirm order, don't require ACTIVE cart.
        if (returnOrderId) {
          if (!cancelled) setResumingOrder(true);
          if (redirectStatus && redirectStatus !== 'succeeded' && redirectStatus !== 'pending') {
            if (!cancelled) {
              setError(
                `Payment was not completed (${redirectStatus}). You can retry from your orders or start checkout again.`,
              );
              setResumingOrder(false);
            }
          } else {
            const confirmRes = await fetch(
              `${API_URL}/api/v1/checkout/orders/${returnOrderId}/confirm`,
              {
                method: 'POST',
                credentials: 'include',
                headers: authHeaders(),
              },
            );
            if (!confirmRes.ok) {
              if (!cancelled) {
                setError(await readApiError(confirmRes));
                setResumingOrder(false);
              }
            } else {
              const confirmed = (await confirmRes.json()) as {
                id: string;
                orderNumber: string;
                status: string;
                total: number;
                currency: string;
              };
              if (!cancelled) {
                setCheckout({
                  orderId: confirmed.id,
                  orderNumber: confirmed.orderNumber,
                  total: confirmed.total,
                  currency: confirmed.currency,
                  clientSecret: null,
                  reservationExpiresAt: '',
                });
                setFinalStatus(confirmed.status);
                if (confirmed.status === 'PAID') {
                  setStep('done');
                  window.history.replaceState({}, '', '/checkout');
                } else {
                  setError(
                    'Payment received but order is still confirming. Refresh shortly or check your orders — status becomes PAID only after server verification.',
                  );
                  setStep('done');
                  window.history.replaceState({}, '', '/checkout');
                }
                setResumingOrder(false);
              }
            }
          }
          // Still try to load cart for a fresh checkout if resume failed and cart exists.
        }

        const cartToken = readCookie('cart_token');
        const cartRes = cartToken
          ? await fetch(`${API_URL}/api/v1/carts/current`, {
              credentials: 'include',
              headers: { 'x-cart-token': cartToken },
            })
          : null;

        if (!cartRes || !cartRes.ok) {
          if (!cancelled) setCart(null);
        } else {
          const body = (await cartRes.json()) as CartView;
          if (!cancelled) {
            setCart(body);
            if (body.branch.clickCollectEnabled) setFulfilmentType('CLICK_AND_COLLECT');
            else if (body.branch.deliveryEnabled) setFulfilmentType('DELIVERY');
          }
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load checkout. Is the API running on :4000?');
          setResumingOrder(false);
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const estimatedTotals = useMemo(() => {
    if (!cart) return null;
    const deliveryFee = fulfilmentType === 'DELIVERY' ? cart.totals.deliveryFee : 0;
    const total =
      cart.totals.subtotal - cart.totals.discountTotal + deliveryFee + cart.totals.taxTotal;
    // taxTotal from cart already includes delivery scenario; for C&C show delivery-free estimate.
    const approxTotal =
      fulfilmentType === 'DELIVERY'
        ? cart.totals.total
        : Math.max(0, cart.totals.total - cart.totals.deliveryFee);
    return {
      subtotal: cart.totals.subtotal,
      discountTotal: cart.totals.discountTotal,
      deliveryFee,
      taxTotal: cart.totals.taxTotal,
      total: approxTotal || total,
    };
  }, [cart, fulfilmentType]);

  function validateFulfilment(): string | null {
    if (!cart) return 'Cart is empty.';
    if (cart.items.length === 0) return 'Your cart is empty.';
    if (cart.hasProblems) return 'Some items are unavailable. Review your cart before checkout.';
    if (fulfilmentType === 'DELIVERY' && !cart.branch.deliveryEnabled) {
      return 'This branch does not offer delivery.';
    }
    if (fulfilmentType === 'CLICK_AND_COLLECT' && !cart.branch.clickCollectEnabled) {
      return 'This branch does not offer click & collect.';
    }
    if (fulfilmentType === 'DELIVERY') {
      if (!address.recipientName.trim()) return 'Recipient name is required.';
      if (!address.line1.trim()) return 'Address line 1 is required.';
      if (!address.city.trim()) return 'City is required.';
      if (!address.postcode.trim()) return 'Postcode is required.';
    }
    return null;
  }

  function goReview() {
    const problem = validateFulfilment();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setStep('review');
  }

  async function startPayment() {
    const problem = validateFulfilment();
    if (problem) {
      setError(problem);
      setStep('fulfilment');
      return;
    }
    if (!cart) return;

    if (!paymentConfig?.configured || !paymentConfig.publishableKey || !stripePromise) {
      setError(
        paymentConfig?.message ??
          'Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY (test keys) in .env, restart the API, and optionally set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY for the storefront.',
      );
      return;
    }

    const cartToken = readCookie('cart_token');
    if (!cartToken) {
      setError('Cart session missing. Add items to your cart and try again.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const body = {
        cartId: cart.id,
        fulfilmentType,
        contactPhone: contactPhone.trim() || undefined,
        notes: notes.trim() || undefined,
        ...(fulfilmentType === 'DELIVERY'
          ? {
              deliveryAddress: {
                recipientName: address.recipientName.trim(),
                line1: address.line1.trim(),
                line2: address.line2.trim() || undefined,
                city: address.city.trim(),
                postcode: address.postcode.trim(),
                country: 'GB',
                phone: address.phone.trim() || contactPhone.trim() || undefined,
              },
            }
          : {}),
      };

      const res = await fetch(`${API_URL}/api/v1/checkout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...authHeaders(),
          'x-cart-token': cartToken,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        setError(await readApiError(res));
        return;
      }

      const result = (await res.json()) as CheckoutResult;
      if (!result.clientSecret) {
        setError(
          'Checkout created an order but no Stripe client secret was returned. Check STRIPE_SECRET_KEY and try again.',
        );
        return;
      }
      setCheckout(result);
      setStep('pay');
    } catch {
      setError('Unable to start payment. Is the API running?');
    } finally {
      setBusy(false);
    }
  }

  if (!loaded || resumingOrder) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-sm text-[var(--nm-muted)]">
        {resumingOrder ? 'Confirming payment…' : 'Loading checkout…'}
      </div>
    );
  }

  if (step === 'done' && checkout) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="font-display text-4xl font-bold tracking-tight text-[var(--nm-ink)]">
          Thank you
        </h1>
        <div className="mt-8 space-y-4 rounded-2xl border border-[var(--nm-line)] bg-[var(--nm-surface)] p-6">
          <p className="text-[var(--nm-ink)]">
            Order <span className="font-semibold">{checkout.orderNumber}</span> —{' '}
            {formatMoney(checkout.total, checkout.currency)}
          </p>
          <p className="text-sm text-[var(--nm-muted)]">
            Status:{' '}
            <span className="font-medium text-[var(--nm-ink)]">{finalStatus ?? 'Confirming…'}</span>
            {finalStatus === 'PAID'
              ? ' Payment verified server-side.'
              : ' If status is not PAID yet, wait for webhook/API confirmation.'}
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild className="h-11 rounded-xl">
              <Link href="/account/orders">View orders</Link>
            </Button>
            <Button asChild variant="outline" className="h-11 rounded-xl">
              <Link href="/products">Keep shopping</Link>
            </Button>
          </div>
        </div>
        {error && (
          <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {error}
          </div>
        )}
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="font-display text-4xl font-bold tracking-tight text-[var(--nm-ink)]">
          Checkout
        </h1>
        <p className="mt-4 text-[var(--nm-muted)]">Your cart is empty.</p>
        {error && (
          <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        )}
        <Button asChild className="mt-6 h-12 rounded-xl px-6">
          <Link href="/products">Continue shopping</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-display text-4xl font-bold tracking-tight text-[var(--nm-ink)]">
        Checkout
      </h1>
      <p className="mt-2 text-sm text-[var(--nm-muted)]">
        {customer.firstName} {customer.lastName} · {customer.email} · {cart.branch.name}
      </p>
      {step !== 'done' && <StepIndicator current={step} />}

      {paymentConfig && !paymentConfig.configured && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">Stripe test keys required for payment</p>
          <p className="mt-1">
            {paymentConfig.message ??
              'Set STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY in .env, then restart the API.'}
          </p>
          <p className="mt-2 text-xs">
            Local webhooks:{' '}
            <code className="rounded bg-amber-100 px-1">
              stripe listen --forward-to localhost:4000/api/v1/payments/webhooks/stripe
            </code>
          </p>
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      {step === 'fulfilment' && (
        <div className="mt-8 space-y-6">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--nm-ink)]">Fulfilment</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={!cart.branch.clickCollectEnabled}
                onClick={() => setFulfilmentType('CLICK_AND_COLLECT')}
                className={[
                  'rounded-2xl border px-4 py-4 text-left transition',
                  fulfilmentType === 'CLICK_AND_COLLECT'
                    ? 'border-[var(--nm-accent)] bg-[var(--nm-accent-soft)]'
                    : 'border-[var(--nm-line)] bg-[var(--nm-surface)]',
                  !cart.branch.clickCollectEnabled ? 'opacity-50' : '',
                ].join(' ')}
              >
                <p className="font-semibold">Click & collect</p>
                <p className="mt-1 text-sm text-[var(--nm-muted)]">
                  Pick up at {cart.branch.name}
                </p>
              </button>
              <button
                type="button"
                disabled={!cart.branch.deliveryEnabled}
                onClick={() => setFulfilmentType('DELIVERY')}
                className={[
                  'rounded-2xl border px-4 py-4 text-left transition',
                  fulfilmentType === 'DELIVERY'
                    ? 'border-[var(--nm-accent)] bg-[var(--nm-accent-soft)]'
                    : 'border-[var(--nm-line)] bg-[var(--nm-surface)]',
                  !cart.branch.deliveryEnabled ? 'opacity-50' : '',
                ].join(' ')}
              >
                <p className="font-semibold">Delivery</p>
                <p className="mt-1 text-sm text-[var(--nm-muted)]">Deliver to your address</p>
              </button>
            </div>
          </section>

          {fulfilmentType === 'DELIVERY' && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-[var(--nm-ink)]">Delivery address</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1 sm:col-span-2">
                  <span className="text-sm text-[var(--nm-muted)]">Recipient</span>
                  <Input
                    value={address.recipientName}
                    onChange={(e) => setAddress((a) => ({ ...a, recipientName: e.target.value }))}
                    required
                  />
                </label>
                <label className="block space-y-1 sm:col-span-2">
                  <span className="text-sm text-[var(--nm-muted)]">Address line 1</span>
                  <Input
                    value={address.line1}
                    onChange={(e) => setAddress((a) => ({ ...a, line1: e.target.value }))}
                    required
                  />
                </label>
                <label className="block space-y-1 sm:col-span-2">
                  <span className="text-sm text-[var(--nm-muted)]">Address line 2</span>
                  <Input
                    value={address.line2}
                    onChange={(e) => setAddress((a) => ({ ...a, line2: e.target.value }))}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm text-[var(--nm-muted)]">City</span>
                  <Input
                    value={address.city}
                    onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))}
                    required
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm text-[var(--nm-muted)]">Postcode</span>
                  <Input
                    value={address.postcode}
                    onChange={(e) => setAddress((a) => ({ ...a, postcode: e.target.value }))}
                    required
                  />
                </label>
                <label className="block space-y-1 sm:col-span-2">
                  <span className="text-sm text-[var(--nm-muted)]">Phone (optional)</span>
                  <Input
                    value={address.phone}
                    onChange={(e) => setAddress((a) => ({ ...a, phone: e.target.value }))}
                  />
                </label>
              </div>
            </section>
          )}

          <section className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-sm text-[var(--nm-muted)]">Contact phone (optional)</span>
              <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            </label>
            <label className="block space-y-1">
              <span className="text-sm text-[var(--nm-muted)]">Order notes (optional)</span>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
          </section>

          <div className="flex gap-3">
            <Button type="button" className="h-12 flex-1 rounded-xl" onClick={goReview}>
              Continue to review
            </Button>
            <Button asChild variant="outline" className="h-12 rounded-xl">
              <Link href="/cart">Back to cart</Link>
            </Button>
          </div>
        </div>
      )}

      {step === 'review' && estimatedTotals && (
        <div className="mt-8 space-y-6">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--nm-ink)]">Order summary</h2>
            <div className="space-y-3 rounded-2xl border border-[var(--nm-line)] bg-[var(--nm-surface)] p-4">
              {cart.items.map((item) => (
                <div key={item.id} className="flex justify-between gap-4 text-sm">
                  <div>
                    <p className="font-medium text-[var(--nm-ink)]">{item.name}</p>
                    <p className="text-[var(--nm-muted)]">
                      {item.variantName} · Qty {item.quantity}
                    </p>
                  </div>
                  <p className="font-medium">{formatMoney(item.unitPrice * item.quantity)}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--nm-line)] bg-[var(--nm-surface)] p-4 text-sm">
            <p className="font-medium text-[var(--nm-ink)]">
              {fulfilmentType === 'DELIVERY' ? 'Delivery' : 'Click & collect'}
            </p>
            {fulfilmentType === 'DELIVERY' ? (
              <p className="mt-1 text-[var(--nm-muted)]">
                {address.recipientName}, {address.line1}
                {address.line2 ? `, ${address.line2}` : ''}, {address.city}, {address.postcode}
              </p>
            ) : (
              <p className="mt-1 text-[var(--nm-muted)]">Collect from {cart.branch.name}</p>
            )}
            <div className="mt-4 space-y-2 text-[var(--nm-muted)]">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatMoney(estimatedTotals.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Discounts</span>
                <span>-{formatMoney(estimatedTotals.discountTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery</span>
                <span>{formatMoney(estimatedTotals.deliveryFee)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold text-[var(--nm-ink)]">
                <span>Estimated total</span>
                <span>{formatMoney(estimatedTotals.total)}</span>
              </div>
            </div>
            <p className="mt-2 text-xs text-[var(--nm-muted)]">
              Final total is computed server-side when the payment intent is created.
            </p>
          </section>

          <div className="flex gap-3">
            <Button
              type="button"
              className="h-12 flex-1 rounded-xl"
              disabled={busy || !paymentConfig?.configured}
              onClick={() => void startPayment()}
            >
              {busy ? 'Creating order…' : 'Continue to payment'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12 rounded-xl"
              onClick={() => setStep('fulfilment')}
            >
              Back
            </Button>
          </div>
        </div>
      )}

      {step === 'pay' && checkout?.clientSecret && stripePromise && (
        <div className="mt-8">
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret: checkout.clientSecret,
              appearance: {
                theme: 'stripe',
                variables: {
                  colorPrimary: '#0f7a63',
                  borderRadius: '12px',
                },
              },
            }}
          >
            <StripePayForm
              orderId={checkout.orderId}
              orderNumber={checkout.orderNumber}
              total={checkout.total}
              currency={checkout.currency}
              onError={(message) => setError(message || null)}
              onPaid={(status) => {
                setFinalStatus(status);
                setStep('done');
              }}
            />
          </Elements>
        </div>
      )}
    </div>
  );
}
