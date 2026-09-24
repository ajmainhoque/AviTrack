"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public retryAfter: number,
  ) {
    super(message);
  }
}
export async function apiFetch<T>(
  url: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      retryAfter?: number;
    };
    throw new ApiError(
      body.error ?? "Service unavailable",
      response.status,
      body.retryAfter ?? 30,
    );
  }
  return response.json() as Promise<T>;
}
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: 10000,
            refetchOnWindowFocus: true,
            refetchIntervalInBackground: false,
          },
        },
      }),
  );
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
