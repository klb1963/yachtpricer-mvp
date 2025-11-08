// frontend/src/components/form/Field.tsx
import type React from 'react';

export type FieldProps = {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export function Field({ label, value, onChange }: FieldProps) {
  return (
    <label className="flex flex-col">
      <span className="text-sm text-gray-600">{label}</span>
      <input className="mt-1 rounded border p-2" value={value} onChange={onChange} />
    </label>
  );
}