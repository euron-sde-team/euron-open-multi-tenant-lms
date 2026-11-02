"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type CartProductType = "course" | "book" | "bundle";

export interface CartItem {
  productId: string;
  productType: CartProductType;
  title: string;
  slug: string;
  thumbnailUrl: string | null;
  priceInr: string | null;
  priceUsd: string | null;
  purchaseMode: string;
}

const CART_STORAGE_KEY_PREFIX = "lms-cart";

function getStorageKey(): string {
  if (typeof window === "undefined") return `${CART_STORAGE_KEY_PREFIX}-default`;
  return `${CART_STORAGE_KEY_PREFIX}-${window.location.host}`;
}

function loadFromStorage(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getStorageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is CartItem =>
        item &&
        typeof item === "object" &&
        typeof item.productId === "string" &&
        typeof item.productType === "string" &&
        typeof item.title === "string" &&
        typeof item.slug === "string"
    );
  } catch {
    return [];
  }
}

function saveToStorage(items: CartItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify(items));
  } catch {
    // Ignore storage errors
  }
}

interface CartContextValue {
  items: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  getTotal: (currency?: "INR" | "USD") => number;
  isInCart: (productId: string) => boolean;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setItems(loadFromStorage());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      saveToStorage(items);
    }
  }, [items, mounted]);

  const addToCart = useCallback((item: CartItem) => {
    setItems((prev) => {
      if (prev.some((i) => i.productId === item.productId)) return prev;
      return [...prev, item];
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const getTotal = useCallback(
    (currency: "INR" | "USD" = "INR") => {
      return items.reduce((sum, item) => {
        const price =
          currency === "INR" ? item.priceInr : item.priceUsd;
        if (!price || item.purchaseMode === "FREE") return sum;
        const num = parseFloat(price);
        return sum + (isNaN(num) ? 0 : num);
      }, 0);
    },
    [items]
  );

  const isInCart = useCallback(
    (productId: string) => items.some((i) => i.productId === productId),
    [items]
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      addToCart,
      removeFromCart,
      clearCart,
      getTotal,
      isInCart,
    }),
    [items, addToCart, removeFromCart, clearCart, getTotal, isInCart]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within CartProvider");
  }
  return ctx;
}

export function useCartOptional(): CartContextValue | null {
  return useContext(CartContext);
}
