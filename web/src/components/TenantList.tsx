import { useEffect, useState } from 'react'
import { listAdminTenants } from '../lib/api'

interface Tenant {
  id: string
  name: string
  status: string
  adapterType: string
  providerType: string
}

export function TenantList({
  onSelect,
  onNew,
}: {
  onSelect: (id: string) => void
  onNew: () => void
}) {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listAdminTenants()
      .then((list) => setTenants(Array.isArray(list) ? list : []))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-6 text-gray-500">Carregando…</div>

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Tenants</h2>
        <button
          onClick={onNew}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
        >
          + Novo Tenant
        </button>
      </div>
      <table className="w-full text-sm">
        <thead className="text-gray-500 border-b">
          <tr>
            <th className="text-left py-2 px-3">ID</th>
            <th className="text-left py-2 px-3">Nome</th>
            <th className="text-left py-2 px-3">Adapter</th>
            <th className="text-left py-2 px-3">Provider</th>
            <th className="text-left py-2 px-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {tenants.map((t) => (
            <tr
              key={t.id}
              onClick={() => onSelect(t.id)}
              className="hover:bg-gray-50 cursor-pointer border-b"
            >
              <td className="py-2 px-3 font-mono">{t.id}</td>
              <td className="py-2 px-3">{t.name}</td>
              <td className="py-2 px-3">{t.adapterType}</td>
              <td className="py-2 px-3">{t.providerType}</td>
              <td className="py-2 px-3">
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    t.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {t.status}
                </span>
              </td>
            </tr>
          ))}
          {tenants.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center text-gray-400 py-8">
                Nenhum tenant cadastrado
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
