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
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={title ?? 'Dialog'}
    >
      <div
        ref={cardRef}
        className="relative z-10 w-full max-w-[900px] rounded-xl bg-white shadow-xl flex flex-col max-h-[calc(100dvh-4rem)] sm:max-h-[90vh]"
      >
        <div className="sticky top-0 flex items-center justify-between border-b px-5 py-3 bg-white">
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

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
}