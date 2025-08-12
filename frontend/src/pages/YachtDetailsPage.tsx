// frontend/src/pages/YachtDetailsPage.tsx

import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getYacht } from '../api'
import type { Yacht } from '../api'
import { PencilSquareIcon } from '@heroicons/react/24/solid'
import { useLocation } from 'react-router-dom';

export default function YachtDetailsPage() {
  const { id } = useParams()
  const [yacht, setYacht] = useState<Yacht | null>(null)
  const [error, setError] = useState<string | null>(null)
  const location = useLocation();

  useEffect(() => {
    if (!id) return
    getYacht(id)
      .then(setYacht)
      .catch((e) => setError(e?.message ?? 'Failed to load yacht'))
  }, [id])

  if (error) return <div className="text-center mt-16 text-red-600">{error}</div>
  if (!yacht) return <div className="text-center mt-16 text-gray-500">Loading…</div>

  const services =
    typeof yacht.currentExtraServices === 'string'
      ? JSON.parse(yacht.currentExtraServices)
      : yacht.currentExtraServices

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">{yacht.name}</h1>
        <div className="flex items-center gap-3">

          <Link
            to={{ pathname: '/dashboard', search: location.search }}
            className="text-blue-600 hover:underline"
          >
            ← Back
          </Link>

          <Link
            to={`/yacht/${yacht.id}/edit`}
            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 hover:bg-blue-700"
          >
            <PencilSquareIcon className="h-5 w-5 text-white" />
            <span className="text-white">Edit</span>
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-2xl border p-5 shadow-sm bg-white">
          <h2 className="font-semibold mb-3">Specs</h2>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-gray-500">Manufacturer</dt>
            <dd>{yacht.manufacturer}</dd>
            <dt className="text-gray-500">Model</dt>
            <dd>{yacht.model}</dd>
            <dt className="text-gray-500">Type</dt>
            <dd>{yacht.type}</dd>
            <dt className="text-gray-500">Length</dt>
            <dd>{yacht.length} m</dd>
            <dt className="text-gray-500">Built</dt>
            <dd>{yacht.builtYear}</dd>
            <dt className="text-gray-500">Cabins / Heads</dt>
            <dd>
              {yacht.cabins} / {yacht.heads}
            </dd>
          </dl>
        </div>

        <div className="rounded-2xl border p-5 shadow-sm bg-white">
          <h2 className="font-semibold mb-3">Charter</h2>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-gray-500">Company</dt>
            <dd>{yacht.charterCompany}</dd>
            <dt className="text-gray-500">Fleet</dt>
            <dd>{yacht.fleet}</dd>
            <dt className="text-gray-500">Location</dt>
            <dd>{yacht.location}</dd>
            <dt className="text-gray-500">Base price</dt>
            <dd>{yacht.basePrice}</dd>
          </dl>
        </div>
      </div>

      <div className="rounded-2xl border p-5 shadow-sm bg-white mt-6">
        <h2 className="font-semibold mb-3">Extra services</h2>
        {Array.isArray(services) && services.length > 0 ? (
          <ul className="list-disc ml-5 text-sm">
            {services.map((s: { name: string; price: number }, i: number) => (
              <li key={i}>
                {s.name} — {s.price}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-gray-500">No data</div>
        )}
      </div>

      <div className="rounded-2xl border p-5 shadow-sm bg-white mt-6">
        <span className="text-gray-600">Owner: </span>
        <span>{yacht.ownerName ?? '—'}</span>
      </div>

    </div>
  )
}
