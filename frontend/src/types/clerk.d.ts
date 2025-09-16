// frontend/src/types/clerk.d.ts
export {};

declare global {
  interface Window {
    Clerk?: {
      session?: {
        // Унифицированная сигнатура (суперсет опций)
        getToken: (opts?: { template?: string; refresh?: boolean }) => Promise<string | null>;
      };
    };
  }
}