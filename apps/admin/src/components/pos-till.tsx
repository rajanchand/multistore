'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { formatMoney } from '@repo/types';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, cn } from '@repo/ui';
import { API_URL, ApiError } from '@/lib/api';
import { adminPath } from '@/lib/admin-path';

type CartLine = {
  productId: string;
  variantId: string;
  name: string;
  variantName: string;
  sku: string;
  barcode: string | null;
  unitPrice: number;
  originalUnitPrice: number;
  quantity: number;
  available: number;
};

type LookupResult = {
  productId: string;
  variantId: string;
  name: string;
  variantName: string;
  sku: string;
  barcode: string | null;
  matchedBy: string;
  unitPrice: number;
  originalUnitPrice: number;
  currency: string;
  available: number;
  image: string | null;
};

type SaleResult = {
  orderId: string;
  orderNumber: string;
  status: string;
  paymentType: 'CASH' | 'CARD';
  source: string;
  total: number;
  currency: string;
  change?: number;
  amountTendered?: number;
  terminalSessionId: string | null;
  terminalDisplayPath: string | null;
};

type TerminalSession = {
  sessionId: string;
  orderNumber: string;
  amount: number;
  currency: string;
  status: 'AWAITING_CARD' | 'APPROVED' | 'DECLINED' | 'CANCELLED' | 'EXPIRED';
  branchName: string;
  failureReason?: string;
};

async function posFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { code?: string; message?: string };
    } | null;
    throw new ApiError(
      body?.error?.code ?? 'ERROR',
      body?.error?.message ?? res.statusText,
      res.status,
    );
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function PosTill({
  branchId,
  branchName,
  branchCode,
}: {
  branchId: string;
  branchName: string;
  branchCode: string;
}) {
  const scanRef = useRef<HTMLInputElement>(null);
  const [scanCode, setScanCode] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [paymentStep, setPaymentStep] = useState<'idle' | 'cash' | 'card'>('idle');
  const [tendered, setTendered] = useState('');
  const [lastSale, setLastSale] = useState<SaleResult | null>(null);
  const [terminal, setTerminal] = useState<TerminalSession | null>(null);

  const total = cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0);

  const focusScan = useCallback(() => {
    scanRef.current?.focus();
  }, []);

  useEffect(() => {
    focusScan();
  }, [focusScan, cart.length, paymentStep]);

  useEffect(() => {
    if (!terminal || terminal.status !== 'AWAITING_CARD') return;
    const id = window.setInterval(() => {
      void posFetch<TerminalSession>(`/pos/terminal/${terminal.sessionId}`)
        .then((session) => {
          setTerminal(session);
          if (session.status === 'APPROVED') {
            setStatusMsg(`Card approved — ${session.orderNumber}`);
            setCart([]);
            setPaymentStep('idle');
            setLastSale((prev) =>
              prev
                ? { ...prev, status: 'PAID' }
                : {
                    orderId: '',
                    orderNumber: session.orderNumber,
                    status: 'PAID',
                    paymentType: 'CARD',
                    source: 'POS',
                    total: session.amount,
                    currency: session.currency,
                    terminalSessionId: session.sessionId,
                    terminalDisplayPath: `/pos/terminal/${session.sessionId}`,
                  },
            );
          } else if (session.status === 'DECLINED' || session.status === 'CANCELLED') {
            setError(session.failureReason ?? `Payment ${session.status.toLowerCase()}`);
            setPaymentStep('idle');
          }
        })
        .catch(() => undefined);
    }, 1500);
    return () => window.clearInterval(id);
  }, [terminal]);

  async function lookupAndAdd(code: string) {
    const trimmed = code.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    setStatusMsg(null);
    setLastSale(null);
    try {
      const item = await posFetch<LookupResult>(
        `/pos/lookup?branchId=${encodeURIComponent(branchId)}&code=${encodeURIComponent(trimmed)}`,
      );
      setCart((prev) => {
        const existing = prev.find((l) => l.variantId === item.variantId);
        if (existing) {
          if (existing.quantity + 1 > item.available) {
            setError(`Only ${item.available} in stock for ${item.name}`);
            return prev;
          }
          return prev.map((l) =>
            l.variantId === item.variantId ? { ...l, quantity: l.quantity + 1 } : l,
          );
        }
        if (item.available < 1) {
          setError(`${item.name} is out of stock at ${branchName}`);
          return prev;
        }
        return [
          ...prev,
          {
            productId: item.productId,
            variantId: item.variantId,
            name: item.name,
            variantName: item.variantName,
            sku: item.sku,
            barcode: item.barcode,
            unitPrice: item.unitPrice,
            originalUnitPrice: item.originalUnitPrice,
            quantity: 1,
            available: item.available,
          },
        ];
      });
      setStatusMsg(`Added ${item.name}`);
      setScanCode('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Lookup failed');
    } finally {
      setBusy(false);
      focusScan();
    }
  }

  function setQty(variantId: string, quantity: number) {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.variantId !== variantId) return l;
          const next = Math.max(0, Math.min(quantity, l.available));
          return { ...l, quantity: next };
        })
        .filter((l) => l.quantity > 0),
    );
  }

  async function completeCash() {
    if (cart.length === 0) return;
    const tenderedMinor = tendered.trim()
      ? Math.round(Number.parseFloat(tendered) * 100)
      : total;
    if (Number.isNaN(tenderedMinor) || tenderedMinor < total) {
      setError('Amount tendered must cover the total');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await posFetch<SaleResult>('/pos/sales', {
        method: 'POST',
        body: JSON.stringify({
          branchId,
          paymentType: 'CASH',
          amountTendered: tenderedMinor,
          items: cart.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
        }),
      });
      setLastSale(result);
      setStatusMsg(`Cash sale ${result.orderNumber} complete`);
      setCart([]);
      setPaymentStep('idle');
      setTendered('');
      setTerminal(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sale failed');
    } finally {
      setBusy(false);
      focusScan();
    }
  }

  async function startCard() {
    if (cart.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const result = await posFetch<SaleResult>('/pos/sales', {
        method: 'POST',
        body: JSON.stringify({
          branchId,
          paymentType: 'CARD',
          items: cart.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
        }),
      });
      setLastSale(result);
      setPaymentStep('card');
      if (result.terminalSessionId) {
        const session = await posFetch<TerminalSession>(`/pos/terminal/${result.terminalSessionId}`);
        setTerminal(session);
        if (result.terminalDisplayPath) {
          const path = result.terminalDisplayPath.startsWith('http')
            ? result.terminalDisplayPath
            : adminPath(result.terminalDisplayPath);
          window.open(path, 'pos-terminal', 'noopener,noreferrer,width=480,height=720');
        }
      }
      setStatusMsg('Amount sent to POS machine — waiting for card…');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start card payment');
      setPaymentStep('idle');
    } finally {
      setBusy(false);
    }
  }

  async function cancelCard() {
    if (!terminal) return;
    setBusy(true);
    try {
      await posFetch(`/pos/terminal/${terminal.sessionId}/cancel`, { method: 'POST', body: '{}' });
      setTerminal(null);
      setPaymentStep('idle');
      setStatusMsg('Card payment cancelled');
      setLastSale(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Cancel failed');
    } finally {
      setBusy(false);
      focusScan();
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle>Scan products</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Use a barcode scanner (keyboard wedge) or type a barcode / SKU, then Enter.
              </p>
            </div>
            <Badge variant="secondary">
              {branchCode} · {branchName}
            </Badge>
          </CardHeader>
          <CardContent>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void lookupAndAdd(scanCode);
              }}
            >
              <Input
                ref={scanRef}
                value={scanCode}
                onChange={(e) => setScanCode(e.target.value)}
                placeholder="Scan barcode or enter SKU…"
                autoComplete="off"
                autoFocus
                disabled={busy || paymentStep === 'card'}
                className="font-mono text-base"
              />
              <Button type="submit" disabled={busy || !scanCode.trim() || paymentStep === 'card'}>
                Add
              </Button>
            </form>
            {(error || statusMsg) && (
              <p
                className={cn(
                  'mt-3 text-sm',
                  error ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                {error ?? statusMsg}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ticket</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {cart.length === 0 ? (
              <p className="text-sm text-muted-foreground">No items yet — scan a product to start.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {cart.map((line) => (
                  <li key={line.variantId} className="flex items-center gap-3 px-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{line.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {line.sku}
                        {line.barcode ? ` · ${line.barcode}` : ''}
                        {line.variantName !== 'Default' && line.variantName !== line.name
                          ? ` · ${line.variantName}`
                          : ''}
                        {' · '}
                        {formatMoney(line.unitPrice)}
                        {line.unitPrice !== line.originalUnitPrice
                          ? ` (was ${formatMoney(line.originalUnitPrice)})`
                          : ''}
                        {' · '}
                        {line.available} in stock at {branchName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={paymentStep === 'card'}
                        onClick={() => setQty(line.variantId, line.quantity - 1)}
                      >
                        −
                      </Button>
                      <span className="w-8 text-center tabular-nums">{line.quantity}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={paymentStep === 'card' || line.quantity >= line.available}
                        onClick={() => setQty(line.variantId, line.quantity + 1)}
                      >
                        +
                      </Button>
                    </div>
                    <p className="w-24 text-right tabular-nums font-medium">
                      {formatMoney(line.unitPrice * line.quantity)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold tabular-nums tracking-tight">{formatMoney(total)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {cart.reduce((s, l) => s + l.quantity, 0)} item
              {cart.reduce((s, l) => s + l.quantity, 0) === 1 ? '' : 's'} · branch stock & prices
            </p>

            {paymentStep === 'idle' && (
              <div className="mt-6 grid gap-2">
                <Button
                  type="button"
                  size="lg"
                  disabled={cart.length === 0 || busy}
                  onClick={() => {
                    setPaymentStep('cash');
                    setTendered((total / 100).toFixed(2));
                    setError(null);
                  }}
                >
                  Pay with cash
                </Button>
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  disabled={cart.length === 0 || busy}
                  onClick={() => void startCard()}
                >
                  Pay with card
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={cart.length === 0 || busy}
                  onClick={() => {
                    setCart([]);
                    setLastSale(null);
                    setError(null);
                    setStatusMsg(null);
                  }}
                >
                  Clear ticket
                </Button>
              </div>
            )}

            {paymentStep === 'cash' && (
              <div className="mt-6 space-y-3">
                <label className="block text-sm font-medium">
                  Amount tendered (£)
                  <Input
                    className="mt-1"
                    inputMode="decimal"
                    value={tendered}
                    onChange={(e) => setTendered(e.target.value)}
                    disabled={busy}
                  />
                </label>
                {tendered.trim() && !Number.isNaN(Number.parseFloat(tendered)) && (
                  <p className="text-sm text-muted-foreground">
                    Change:{' '}
                    <span className="font-medium text-foreground">
                      {formatMoney(Math.max(0, Math.round(Number.parseFloat(tendered) * 100) - total))}
                    </span>
                  </p>
                )}
                <div className="flex gap-2">
                  <Button type="button" className="flex-1" disabled={busy} onClick={() => void completeCash()}>
                    Complete cash sale
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setPaymentStep('idle');
                      setTendered('');
                    }}
                  >
                    Back
                  </Button>
                </div>
              </div>
            )}

            {paymentStep === 'card' && terminal && (
              <div className="mt-6 space-y-3 rounded-md border bg-muted/40 p-4">
                <p className="text-sm font-medium">POS machine</p>
                <p className="text-3xl font-semibold tabular-nums">{formatMoney(terminal.amount)}</p>
                <p className="text-sm text-muted-foreground">
                  Status: <Badge variant="warning">{terminal.status.replaceAll('_', ' ')}</Badge>
                </p>
                <p className="text-xs text-muted-foreground">
                  Amount is shown on the terminal display. Approve or decline there (or open it again).
                </p>
                <div className="flex flex-wrap gap-2">
                  {lastSale?.terminalDisplayPath && (
                    <Button type="button" variant="outline" size="sm" asChild>
                      <Link href={lastSale.terminalDisplayPath} target="_blank">
                        Open POS machine
                      </Link>
                    </Button>
                  )}
                  <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void cancelCard()}>
                    Cancel payment
                  </Button>
                </div>
              </div>
            )}

            {lastSale && lastSale.paymentType === 'CASH' && lastSale.status === 'PAID' && (
              <div className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950/40">
                <p className="font-medium">Sale complete — {lastSale.orderNumber}</p>
                {typeof lastSale.change === 'number' && (
                  <p className="mt-1 text-muted-foreground">
                    Change due: <span className="font-medium text-foreground">{formatMoney(lastSale.change)}</span>
                  </p>
                )}
                <Link className="mt-2 inline-block text-sm underline" href={`/orders/${lastSale.orderId}`}>
                  View order
                </Link>
              </div>
            )}

            {lastSale && lastSale.paymentType === 'CARD' && lastSale.status === 'PAID' && (
              <div className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950/40">
                <p className="font-medium">Card sale complete — {lastSale.orderNumber}</p>
                {lastSale.orderId && (
                  <Link className="mt-2 inline-block text-sm underline" href={`/orders/${lastSale.orderId}`}>
                    View order
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
