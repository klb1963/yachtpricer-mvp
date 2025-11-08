// frontend/src/components/form/Legend.tsx
import type { ReactNode } from 'react';

export function Legend({ children }: { children: ReactNode }) {
  return <div className="mb-3 font-semibold col-span-full">{children}</div>;
}