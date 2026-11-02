"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Razorpay types (client-side SDK loaded via script tag)
// ---------------------------------------------------------------------------

export interface RazorpaySuccessResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface RazorpayOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  image?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  handler: (response: RazorpaySuccessResponse) => void;
  modal?: {
    ondismiss?: () => void;
    escape?: boolean;
    confirm_close?: boolean;
  };
  theme?: {
    color?: string;
  };
}

interface RazorpayInstance {
  open(): void;
  close(): void;
  on(event: string, callback: (...args: unknown[]) => void): void;
}

interface RazorpayConstructor {
  new (options: RazorpayOptions): RazorpayInstance;
}

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

// ---------------------------------------------------------------------------
// Script loader
// ---------------------------------------------------------------------------

const RAZORPAY_SCRIPT_URL =
  process.env.NEXT_PUBLIC_RAZORPAY_CHECKOUT_URL || "https://checkout.razorpay.com/v1/checkout.js";

let scriptPromise: Promise<void> | null = null;

function loadRazorpayScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Cannot load Razorpay in a non-browser environment"));
      return;
    }

    if (window.Razorpay) {
      resolve();
      return;
    }

    const existing = document.querySelector(
      `script[src="${RAZORPAY_SCRIPT_URL}"]`
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load Razorpay script"))
      );
      return;
    }

    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Failed to load Razorpay script"));
    };
    document.body.appendChild(script);
  });

  return scriptPromise;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseRazorpayReturn {
  isLoaded: boolean;
  error: string | null;
  openRazorpay: (options: RazorpayOptions) => void;
}

export function useRazorpay(): UseRazorpayReturn {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const instanceRef = useRef<RazorpayInstance | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadRazorpayScript()
      .then(() => {
        if (!cancelled) setIsLoaded(true);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load Razorpay"
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const openRazorpay = useCallback(
    (options: RazorpayOptions) => {
      if (!window.Razorpay) {
        setError("Razorpay SDK not loaded");
        return;
      }
      instanceRef.current = new window.Razorpay(options);
      instanceRef.current.open();
    },
    []
  );

  return { isLoaded, error, openRazorpay };
}
