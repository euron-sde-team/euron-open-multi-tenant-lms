"use client";

import { useEffect, useState } from "react";

type Tokens = Record<string, string>;

const DEFAULT_TOKENS: Tokens = {
  primary: "hsl(221 83% 53%)",
  success: "hsl(142 71% 45%)",
  warning: "hsl(38 92% 50%)",
  destructive: "hsl(0 84% 60%)",
  muted: "hsl(210 40% 96%)",
  foreground: "hsl(222 47% 11%)",
  border: "hsl(214 32% 91%)",
};

const KEYS = ["primary", "success", "warning", "destructive", "muted", "foreground", "border"] as const;

function readTokens(): Tokens {
  if (typeof window === "undefined") return DEFAULT_TOKENS;
  const style = getComputedStyle(document.documentElement);
  const next: Tokens = {};
  for (const k of KEYS) {
    const raw = style.getPropertyValue(`--${k}`).trim();
    next[k] = raw ? `hsl(${raw})` : DEFAULT_TOKENS[k];
  }
  return next;
}

/**
 * Returns CSS variables resolved to hsl() strings so charts and inline-fill
 * components can stay in sync with the tenant theme. Re-reads on hydration so
 * SSR is safe.
 */
export function useThemeTokens(): Tokens {
  const [tokens, setTokens] = useState<Tokens>(DEFAULT_TOKENS);
  useEffect(() => {
    setTokens(readTokens());
  }, []);
  return tokens;
}
