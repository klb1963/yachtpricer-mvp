import { useEffect, useState } from 'react';
import type { Yacht } from '../api';
import { getYachts } from '../api';

export default function DashboardPage() {
  const [data, setData] = useState<Yacht[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getYachts()
      .then(setData)
      .catch((e) => setErr(e.message ?? 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="mt-10 text-center">Loading…</div>;
  if (err) return <div className="mt-10 text-center text-red-600">{err}</div>;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="mb-4 text-3xl font-bold">Yachts</h1>

      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="[&>th]:px-4 [&>th]:py-2 text-left">
              <th>Name</th>
              <th>Model</th>
              <th>Type</th>
              <th>Length</th>
              <th>Year</th>
              <th>Location</th>
              <th>Price (base)</th>
            </tr>
          </thead>
          <tbody>
            {data.map((y) => (
              <tr key={y.id} className="border-t [&>td]:px-4 [&>td]:py-2">
                <td className="font-medium">{y.name}</td>
                <td>{y.manufacturer} {y.model}</td>
                <td>{y.type}</td>
                <td>{y.length} m</td>
                <td>{y.builtYear}</td>
                <td>{y.location}</td>
                <td>
                  {typeof y.basePrice === 'string' ? y.basePrice : y.basePrice?.toFixed?.(0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}