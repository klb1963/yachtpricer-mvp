// frontend/src/components/ConfirmActionModal.tsx

import { useEffect, useRef, useCallback } from 'react';

type Props = {
  open: boolean;
  title: string;
  confirmLabel?: string;
  placeholder?: string;
  defaultValue?: string;
  submitting?: boolean;
  onCancel: () => void;
  onConfirm: (comment: string) => void;
};

export default function ConfirmActionModal({
  open,
  title,
  confirmLabel = 'Confirm',
  placeholder = 'Add a comment (optional)…',
  defaultValue = '',
  submitting = false,
  onCancel,
  onConfirm,
}: Props) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Фокус и сброс текста при открытии
  useEffect(() => {
    if (open) {
      // сброс к defaultValue
      if (areaRef.current) areaRef.current.value = defaultValue;
      // фокус
      setTimeout(() => areaRef.current?.focus(), 0);
    }
  }, [open, defaultValue]);

  // Закрытие по Escape
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, submitting, onCancel]);

  // Клик по фону (outside-click)
  const onBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (submitting) return;
      if (e.target === e.currentTarget) onCancel();
    },
    [onCancel, submitting],
  );

  const handleConfirm = useCallback(() => {
    const comment = areaRef.current?.value ?? '';
    onConfirm(comment.trim());
  }, [onConfirm]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onMouseDown={onBackdropClick}
      aria-modal="true"
      role="dialog"
      aria-labelledby="confirm-modal-title"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl"
        // предотвращаем закрытие при клике внутри
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-modal-title" className="text-lg font-semibold mb-3">
          {title}
        </h3>

        <textarea
          ref={areaRef}
          className="w-full h-28 resize-y rounded border p-2"
          placeholder={placeholder}
          defaultValue={defaultValue}
          disabled={submitting}
          aria-label="Comment"
        />

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="px-3 py-1.5 rounded border"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? 'Saving…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}