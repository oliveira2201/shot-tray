import { useEffect, useState } from 'react'
import { fetchOverview } from '../lib/api'

interface PipelineEntry {
  event: string
  alias: string
  flow: { id: string; title: string; stepsCount: number; stepTypes: string[] } | null
}

interface RoutingRule {
  condition: string
  type?: string
  flowAlias: string
  description?: string
  flowId?: string | null
  flowTitle?: string | null
  active?: boolean
}

interface AdapterRouting {
  name: string
  webhookMethod: string
  contentType: string
  payloadExample: Record<string, string>
  fields: { key: string; description: string; required: boolean }[]
  rules: RoutingRule[]
}

interface Overview {
  tenant: {
    id: string
    name: string
    adapter: string
    provider: string
    webhookUrl: string
    baseUrl: string
    token: string | null
  }
  pipeline: PipelineEntry[]
  flows: any[]
  unmappedFlows: any[]
  adapterRouting?: AdapterRouting
}

interface Props {
  tenantId: string
  onOpenFlow: (flowId: string) => void
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
  const [showPayload, setShowPayload] = useState(false)
  const [showRouting, setShowRouting] = useState(true)

  useEffect(() => {
    setError('')
    setData(null)
    fetchOverview(tenantId)
      .then((res) => {
        if (res.error) { setError(res.error); return }
        setData(res)
      })
      .catch((e) => setError(e.message || 'Erro ao carregar'))
  }, [tenantId])

  if (error) return <div className="p-6 text-red-500 text-sm">Erro: {error} — reinicie o servidor</div>
  if (!data) return <div className="p-6 text-gray-400 text-sm">Carregando...</div>

  const routing = data.adapterRouting

  return (
    <div className="p-6 max-w-5xl mx-auto overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">{data.tenant.name}</h1>
          <p className="text-sm text-gray-400 mt-1">Pipeline de automação</p>
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
        <button onClick={onOpenSettings} className="text-left bg-gray-50 rounded-lg border border-gray-200 p-3 hover:bg-gray-100 transition-colors">
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Webhook URL</div>
          <div className="text-sm text-gray-700 font-mono truncate">{data.tenant.webhookUrl}</div>
        </button>
        <button onClick={onOpenSettings} className="text-left bg-gray-50 rounded-lg border border-gray-200 p-3 hover:bg-gray-100 transition-colors">
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Integração</div>
          <div className="text-sm text-gray-700">{ADAPTER_LABELS[data.tenant.adapter] || data.tenant.adapter}</div>
        </button>
        <button onClick={onOpenSettings} className="text-left bg-gray-50 rounded-lg border border-gray-200 p-3 hover:bg-gray-100 transition-colors">
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Canal</div>
          <div className="text-sm text-gray-700 truncate">{data.tenant.provider} ({data.tenant.baseUrl})</div>
        </button>
      </div>

      {/* Webhook Payload Esperado */}
      {routing && (
        <div className="mb-6">
          <button
            onClick={() => setShowPayload(!showPayload)}
            className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 hover:text-gray-600"
          >
            <span>{showPayload ? '▼' : '▶'}</span>
            Payload esperado ({routing.name})
          </button>
          {showPayload && (
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-4">
              {/* Método e Content-Type */}
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Método:</span>{' '}
                  <span className="font-mono font-bold text-green-600">{routing.webhookMethod}</span>
                </div>
                <div>
                  <span className="text-gray-400">Content-Type:</span>{' '}
                  <span className="font-mono text-gray-600">{routing.contentType}</span>
                </div>
              </div>

              {/* Campos */}
              <div>
                <div className="text-xs font-bold text-gray-500 mb-2">Campos</div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] text-gray-400 uppercase">
                      <th className="pb-1 pr-4">Campo</th>
                      <th className="pb-1 pr-4">Descrição</th>
                      <th className="pb-1">Obrigatório</th>
                    </tr>
                  </thead>
                  <tbody>
                    {routing.fields.map((f) => (
                      <tr key={f.key} className="border-t border-gray-100">
                        <td className="py-1.5 pr-4 font-mono text-xs text-blue-600">{f.key}</td>
                        <td className="py-1.5 pr-4 text-gray-600">{f.description}</td>
                        <td className="py-1.5">
                          {f.required ? (
                            <span className="text-red-500 text-xs font-bold">Sim</span>
                          ) : (
                            <span className="text-gray-300 text-xs">Não</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Exemplo */}
              <div>
                <div className="text-xs font-bold text-gray-500 mb-2">Exemplo de payload</div>
                <pre className="bg-gray-800 text-green-300 rounded p-3 text-xs overflow-x-auto">
                  {JSON.stringify(routing.payloadExample, null, 2)}
                </pre>
              </div>

              {/* Curl de teste */}
              <div>
                <div className="text-xs font-bold text-gray-500 mb-2">Teste via curl</div>
                <pre className="bg-gray-800 text-gray-300 rounded p-3 text-xs overflow-x-auto whitespace-pre-wrap">
{`curl -X POST http://localhost:3100${data.tenant.webhookUrl} \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(routing.payloadExample)}'`}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Regras de Roteamento */}
      {routing && (
        <div className="mb-6">
          <button
            onClick={() => setShowRouting(!showRouting)}
            className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 hover:text-gray-600"
          >
            <span>{showRouting ? '▼' : '▶'}</span>
            Regras de roteamento ({routing.rules.length} regras)
          </button>
          {showRouting && (
            <div className="space-y-1.5">
              {routing.rules.map((rule, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 rounded-lg border p-3 ${
                    rule.active === false
                      ? 'bg-gray-50 border-gray-200 opacity-50'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  {/* Condição */}
                  <div className="w-64 shrink-0">
                    <div className="font-mono text-xs text-purple-600">{rule.condition}</div>
                    {rule.description && (
                      <div className="text-[10px] text-gray-400 mt-0.5">{rule.description}</div>
                    )}
                  </div>

                  {/* Seta */}
                  <div className="text-gray-300 shrink-0">→</div>

                  {/* Flow alias */}
                  <div className="font-mono text-xs text-gray-500 w-48 shrink-0 truncate" title={rule.flowAlias}>
                    {rule.flowAlias}
                  </div>

                  {/* Seta */}
                  <div className="text-gray-300 shrink-0">→</div>

                  {/* Flow */}
                  {rule.flowId ? (
                    <button
                      onClick={() => onOpenFlow(rule.flowId!)}
                      className="flex-1 text-left px-3 py-1 rounded bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
                    >
                      <div className="text-sm font-medium text-blue-700">{rule.flowTitle}</div>
                    </button>
                  ) : (
                    <div className="flex-1 px-3 py-1 rounded bg-red-50 border border-red-200">
                      <div className="text-xs text-red-500">Sem flow mapeado</div>
                    </div>
                  )}

                  {/* Status */}
                  <div className="shrink-0">
                    {rule.active === false ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-500">OFF</span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-600">ON</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Flows sem evento */}
      {data.unmappedFlows.length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
            Flows sem evento mapeado
          </h2>
          <div className="flex gap-2 flex-wrap">
            {data.unmappedFlows.map((f: any) => (
              <button key={f.id} onClick={() => onOpenFlow(f.id)}
                className="px-3 py-2 rounded bg-gray-50 border border-gray-200 text-sm hover:bg-gray-100 transition-colors"
              >
                {f.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
