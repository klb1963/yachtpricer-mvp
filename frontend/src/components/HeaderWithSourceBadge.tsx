// frontend/src/components/HeaderWithSourceBadge.tsx
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function HeaderWithSourceBadge() {
  const [searchParams] = useSearchParams();
  const { t } = useTranslation("dashboard");

  // читаем текущий source из URL
  const raw = (searchParams.get("source") || "").toUpperCase();
  const isValid = raw === "NAUSYS" || raw === "INNERDB";
  const source = isValid ? (raw as "NAUSYS" | "INNERDB") : null;

  return (
    <div className="flex items-center justify-between mt-2 mb-2">
      {/* слева — место под WeekPicker (сейчас пусто, но не ломаем верстку) */}
      <div />

      {/* справа — бейдж */}
      {source && (
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ml-3 ${
            source === "NAUSYS"
              ? "bg-green-200 text-green-800"
              : "bg-gray-200 text-gray-700"
          }`}
          title={t("sourceBadge.tooltip", "Current scan data source")}
        >
          {t("sourceBadge.label", "Source")}: {source}
        </span>
      )}
    </div>
  );
}