// frontend/src/components/Modal.tsx
import React, { PropsWithChildren, useEffect, useRef } from "react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
};

export default function Modal({
  open,
  onClose,
  title,
  children,
}: PropsWithChildren<ModalProps>) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Закрыть по Esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const key = e.key || (e as unknown as { code?: string }).code;
      if (key === "Escape" || key === "Esc") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={title ?? "Dialog"}
    >
      {/* backdrop */}
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      {/* card */}
      <div
        ref={cardRef}
        className="relative z-10 w-full max-w-2xl rounded-xl bg-white p-4 shadow-xl"
      >
        <div className="mb-3 flex items-center justify-between">
          {title ? <h3 className="text-lg font-semibold">{title}</h3> : <div />}
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-sm hover:bg-gray-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}