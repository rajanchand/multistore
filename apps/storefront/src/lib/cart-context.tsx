'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { API_URL } from '@/lib/api';

const CART_COOKIE = 'cart_token';

type CartLine = { quantity: number };

type CartView = {
  items?: CartLine[];
};

type CartContextValue = {
  itemCount: number;
  bumpPulse: number;
  setFromCart: (cart: CartView | null | undefined) => void;
  refreshCart: () => Promise<void>;
  /** Optimistic bump used while waiting for server (optional). */
  optimisticAdd: (qty?: number) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function countItems(cart: CartView | null | undefined): number {
  if (!cart?.items?.length) return 0;
  return cart.items.reduce((sum, line) => sum + (line.quantity || 0), 0);
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [itemCount, setItemCount] = useState(0);
  const [bumpPulse, setBumpPulse] = useState(0);

  const setFromCart = useCallback((cart: CartView | null | undefined) => {
    const next = countItems(cart);
    setItemCount((prev) => {
      if (next > prev) {
        queueMicrotask(() => setBumpPulse((n) => n + 1));
      }
      return next;
    });
  }, []);

  const refreshCart = useCallback(async () => {
    const token = readCookie(CART_COOKIE);
    if (!token) {
      setItemCount(0);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/v1/carts/current`, {
        headers: { 'x-cart-token': token },
        credentials: 'include',
      });
      if (!res.ok) {
        if (res.status === 404) setItemCount(0);
        return;
      }
      const body = (await res.json()) as CartView;
      setFromCart(body);
    } catch {
      /* keep last known count offline */
    }
  }, [setFromCart]);

  const optimisticAdd = useCallback((qty = 1) => {
    setItemCount((n) => n + qty);
    setBumpPulse((n) => n + 1);
  }, []);

  useEffect(() => {
    void refreshCart();
    const onFocus = () => void refreshCart();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshCart]);

  const value = useMemo(
    () => ({ itemCount, bumpPulse, setFromCart, refreshCart, optimisticAdd }),
    [itemCount, bumpPulse, setFromCart, refreshCart, optimisticAdd],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    return {
      itemCount: 0,
      bumpPulse: 0,
      setFromCart: () => undefined,
      refreshCart: async () => undefined,
      optimisticAdd: () => undefined,
    };
  }
  return ctx;
}
