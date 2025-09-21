// frontend/src/components/NumberField.tsx

import React from "react";

type Props = {
   label: string;
   value: number;
   onChange: (v: number) => void;
   min?: number;
   max?: number;
 };
 
    export default function NumberField({ label, value, onChange, min = 0, max = 5 }: Props) {
    const toInt = (s: string, def: number) => {
        const n = parseInt(s, 10);
        return Number.isFinite(n) ? n : def;
    };
    const clamp = (v: number) => Math.max(min, Math.min(max, v));
    return (
        <label className="flex flex-col gap-1">
        <span className="font-medium">{label}</span>
        <input
            type="number"
            inputMode="numeric"
            className="border rounded p-1 w-24"
            value={value}
            min={min}
            max={max}
            onChange={(e) => onChange(clamp(toInt(e.target.value, value)))}
        />
        </label>
    );
}