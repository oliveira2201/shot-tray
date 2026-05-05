import { useEffect, useState } from 'react'
import { fetchOverview } from '../lib/api'

interface FlowSummary {
  slug: string
  title: string
  description: string
  aliases: string[]
  enabled: boolean
  stepsCount: number
  stepTypes: string[]
}

interface Overview {
  tenant: {
    id: string
    name: string
    status: string
    adapter: string
    provider: string
    webhookUrl: string
    baseUrl: string
    token: string | null
    adapterConfig?: any
  }
  flows: FlowSummary[]
  templates: { total: number; byKind: Record<string, number> }
}

interface Props {
  tenantId: string
  onOpenFlow: (slug: string) => void
  onOpenSettings: () => void
}

const ADAPTER_LABELS: Record<string, string> = {
  default: 'Genérico',
  nuvemshop: 'Nuvemshop',
  tray: 'Tray',
}

export function Dashboard({ tenantId, onOpenFlow, onOpenSettings }: Props) {
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setError('')
    setData(null)
    fetchOverview(tenantId)
      .then((res) => {
        if (res.error) {
          setError(res.error)
          return
        }
        setData(res)
      })
      .catch((e) => setError(e.message || 'Erro ao carregar'))
  }, [tenantId])

  if (error)
    return (
      <div className="p-6 text-red-500 text-sm">
        Erro: {error}
      </div>
    )
  if (!data)
    return <div className="p-6 text-gray-400 text-sm">Carregando...</div>

  return (
    <div className="p-6 max-w-5xl mx-auto overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">{data.tenant.name}</h1>
          <p className="text-sm text-gray-400 mt-1">
            {data.tenant.status === 'active' ? 'Ativo' : 'Desativado'} ·{' '}
            {data.flows.length} flows · {data.templates.total} templates
          </p>
        </div>
        <button
          onClick={onOpenSettings}
          className="px-3 py-1.5 rounded text-sm bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
        >
          Editar configurações
        </button>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <button
          onClick={onOpenSettings}
          className="text-left bg-gray-50 rounded-lg border border-gray-200 p-3 hover:bg-gray-100 transition-colors"
        >
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">
            Webhook URL
          </div>
          <div className="text-sm text-gray-700 font-mono truncate">
            {data.tenant.webhookUrl}
          </div>
        </button>
        <button
          onClick={onOpenSettings}
          className="text-left bg-gray-50 rounded-lg border border-gray-200 p-3 hover:bg-gray-100 transition-colors"
        >
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">
            Integração
          </div>
          <div className="text-sm text-gray-700">
            {ADAPTER_LABELS[data.tenant.adapter] || data.tenant.adapter}
          </div>
        </button>
        <button
          onClick={onOpenSettings}
          className="text-left bg-gray-50 rounded-lg border border-gray-200 p-3 hover:bg-gray-100 transition-colors"
        >
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">
            Canal
          </div>
          <div className="text-sm text-gray-700 truncate">
            {data.tenant.provider}
            {data.tenant.token && ` · token ${data.tenant.token}`}
          </div>
        </button>
      </div>

      {/* Flows cadastrados */}
      <div className="mb-6">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
          Flows cadastrados ({data.flows.length})
        </h2>
        {data.flows.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
            Nenhum flow cadastrado. Adicione na aba <strong>Flows</strong> da
            edição do tenant.
          </div>
        ) : (
          <div className="space-y-1.5">
            {data.flows.map((f) => (
              <button
                key={f.slug}
                onClick={() => onOpenFlow(f.slug)}
                className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                  f.enabled
                    ? 'bg-white border-gray-200 hover:bg-gray-50'
                    : 'bg-gray-50 border-gray-200 opacity-60'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-purple-600">
                      {f.slug}
                    </span>
                    {!f.enabled && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-500">
                        OFF
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-800 mt-0.5 truncate">
                    {f.title}
                  </div>
                  {f.aliases.length > 0 && (
                    <div className="text-[11px] text-gray-400 font-mono mt-0.5 truncate">
                      aliases: {f.aliases.join(', ')}
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-400 shrink-0">
                  {f.stepsCount} steps
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
