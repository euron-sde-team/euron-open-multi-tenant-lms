"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- React 18 types mismatch with @tanstack/react-query
  return <QueryClientProvider client={queryClient}>{children as any}</QueryClientProvider>;
}
