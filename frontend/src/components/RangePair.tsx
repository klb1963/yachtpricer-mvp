// frontend/src/components/RangePair.tsx

// frontend/src/components/RangePair.tsx
import React from "react";

type Props = {
  label: string;
  minus: number;
  plus: number;
  setMinus: (v: number) => void;
  setPlus: (v: number) => void;
  min?: number;
  max?: number;
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export default function RangePair({
  label,
  minus,
  plus,
  setMinus,
  setPlus,
  min = 0,
  max = 5,
}: Props) {
  const toInt = (s: string, def: number) => {
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : def;
  };

  return (
    <label className="flex flex-col gap-1">
      <span className="font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" className="border rounded px-2" onClick={() => setMinus(clamp(minus - 1, min, max))}>−</button>
        <input
          type="number"
          inputMode="numeric"
          className="border rounded p-1 w-20 text-center"
          value={minus}
          min={min}
          max={max}
          onChange={(e) => setMinus(clamp(toInt(e.target.value, minus), min, max))}
        />
        <button type="button" className="border rounded px-2" onClick={() => setMinus(clamp(minus + 1, min, max))}>+</button>
        <span className="opacity-60">/</span>
        <button type="button" className="border rounded px-2" onClick={() => setPlus(clamp(plus - 1, min, max))}>−</button>
        <input
          type="number"
          inputMode="numeric"
          className="border rounded p-1 w-20 text-center"
          value={plus}
          min={min}
          max={max}
          onChange={(e) => setPlus(clamp(toInt(e.target.value, plus), min, max))}
        />
        <button type="button" className="border rounded px-2" onClick={() => setPlus(clamp(plus + 1, min, max))}>+</button>
      </div>
    </label>
  );
}
