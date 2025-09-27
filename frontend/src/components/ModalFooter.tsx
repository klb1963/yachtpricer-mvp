// frontend/src/components/ModalFooter.tsx
type ModalFooterProps = {
  onCancel: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  submitting?: boolean;
  submitDisabled?: boolean;
  leftContent?: React.ReactNode; // 👈 добавляем возможность слева вставлять произвольный контент
};
export default function ModalFooter({
  onCancel,
  submitLabel = "Save",
  cancelLabel = "Cancel",
  submitting,
  submitDisabled,
  leftContent,
}: ModalFooterProps) {
  return (
    <div className="mt-6 flex items-center justify-between">
      {/* Левая часть (например, Test filters) */}
      <div>{leftContent}</div>

      {/* Правая часть (Cancel + Submit) */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/50"
        >
          {cancelLabel}
        </button>
        <button
          type="submit"
          disabled={submitting || submitDisabled}
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Saving…" : submitLabel}
        </button>
      </div>
    </div>
  );
}