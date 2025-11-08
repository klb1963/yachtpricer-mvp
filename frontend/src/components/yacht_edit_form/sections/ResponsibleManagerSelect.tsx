// frontend/src/components/yacht/ResponsibleManagerSelect.tsx

import { useEffect, useMemo, useState } from 'react';
import Select from 'react-select';
import { api } from '../../../api';

type Role = 'ADMIN' | 'FLEET_MANAGER' | 'MANAGER' | 'OWNER';

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  isActive: boolean;
};

type Opt = { value: string; label: string };

type Props = {
  value: string;
  onChange: (id: string) => void;
  label?: string;
};

export function ResponsibleManagerSelect({
  value,
  onChange,
  label = 'Ответственный менеджер',
}: Props) {
  const [options, setOptions] = useState<Opt[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const { data } = await api.get<{ items: UserRow[] }>('/users', {
          params: { page: 1, limit: 100 },
        });

        if (cancelled) return;

        const managers = data.items.filter(
          (u) =>
            u.isActive &&
            ['MANAGER', 'FLEET_MANAGER', 'ADMIN'].includes(u.role),
        );

        const opts: Opt[] = managers.map((u) => ({
          value: u.id,
          label: (u.name && u.name.trim()) || u.email,
        }));

        setOptions(opts);
      } catch {
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo<Opt | null>(() => {
    if (!value) return null;
    return (
      options.find((o) => o.value === value) ?? {
        value,
        label: value,
      }
    );
  }, [value, options]);

  return (
    <label className="flex flex-col">
      <span className="text-sm text-gray-600">{label}</span>
      <Select<Opt, false>
        className="mt-1"
        classNamePrefix="rs"
        isClearable
        options={options}
        value={selected}
        onChange={(opt) => {
          const v = opt?.value ?? '';
          onChange(v);
        }}
        placeholder={loading ? 'Загрузка менеджеров…' : 'Выберите менеджера…'}
      />
    </label>
  );
}