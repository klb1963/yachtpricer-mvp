// frontend/src/components/ConfirmActionModal.tsx

import { useEffect, useRef } from 'react';

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

  useEffect(() => {
    if (open) setTimeout(() => areaRef.current?.focus(), 0);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
        <h3 className="text-lg font-semibold mb-3">{title}</h3>
        <textarea
          ref={areaRef}
          className="w-full h-28 resize-y rounded border p-2"
          placeholder={placeholder}
          defaultValue={defaultValue}
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="px-3 py-1.5 rounded border"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            className="px-3 py-1.5 rounded text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
            onClick={() => onConfirm(areaRef.current?.value ?? '')}
            disabled={submitting}
          >
            {submitting ? 'Saving…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}