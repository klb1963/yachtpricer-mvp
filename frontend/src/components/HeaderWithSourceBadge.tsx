// frontend/src/components/HeaderWithSourceBadge.tsx

import { useSearchParams } from "react-router-dom";

export function HeaderWithSourceBadge() {
  const [searchParams, setSearchParams] = useSearchParams();

  // читаем текущий source из URL
  const raw = (searchParams.get("source") || "").toUpperCase();
  const isValid = raw === "NAUSYS" || raw === "INNERDB";
  const source = isValid ? (raw as "NAUSYS" | "INNERDB") : null;

  // опционально: если параметра нет — подставить дефолт из localStorage (и записать в URL)
  // убери этот useEffect, если не хочешь автоподстановку
  // useEffect(() => {
  //   if (!source) {
  //     const ls = (localStorage.getItem("competitor:scanSource") || "INNERDB").toUpperCase();
  //     if (ls === "NAUSYS" || ls === "INNERDB") {
  //       const next = new URLSearchParams(searchParams);
  //       next.set("source", ls);
  //       setSearchParams(next, { replace: true });
  //     }
  //   }
  // }, [source, searchParams, setSearchParams]);

  return (
    <div className="flex items-center justify-between">
      {/* слева место под WeekPicker — его рендерится в родителе */}
      <div />
      {/* справа — бейдж; если параметр невалиден/отсутствует, бейдж скрываем */}
      {source && (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            source === "NAUSYS"
              ? "bg-green-200 text-green-800"
              : "bg-gray-200 text-gray-700"
          }`}
          title="Current scan data source"
        >
          Source: {source}
        </span>
      )}
    </div>
  );
}