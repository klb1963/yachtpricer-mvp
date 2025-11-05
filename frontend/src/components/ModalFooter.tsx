// frontend/src/components/ModalFooter.tsx
type ModalFooterProps = {
  onCancel: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  submitting?: boolean;
  submitDisabled?: boolean;
  leftContent?: React.ReactNode;
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
    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Левая часть (например, Reset/Test filters) */}
      <div className="order-2 w-full sm:order-1 sm:w-auto">
        {leftContent}
      </div>

      {/* Правая часть (Cancel + Submit) */}
      <div className="order-1 flex w-full gap-3 sm:order-2 sm:w-auto sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex w-full items-center justify-center rounded-md border px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/50 sm:w-auto"
        >
          {cancelLabel}
        </button>
        <button
          type="submit"
          disabled={submitting || submitDisabled}
          className="inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/50 disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto"
        >
          {submitting ? "Saving…" : submitLabel}
        </button>
      </div>
    </div>
  );
}