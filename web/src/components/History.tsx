import { useEffect, useState, useCallback } from 'react'
import { fetchExecutions, fetchExecution } from '../lib/api'

interface StepLog {
  type: string
  label?: string
  status: 'ok' | 'error' | 'skipped' | 'pending'
  durationMs?: number
  error?: string
  input?: any
  output?: any
}

interface ExecutionRow {
  id: string
  tenantId: string
  flowId: string
  flowAlias: string
  phone: string | null
  customerName: string | null
  status: string
  trigger: string
  steps: StepLog[]
  error: string | null
  startedAt: string
  completedAt: string | null
  durationMs: number | null
  webhookPayload?: any
}

const STATUS_COLOR: Record<string, string> = {
  running: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-600',
  deferred: 'bg-amber-100 text-amber-700',
}

const STEP_STATUS_ICON: Record<string, string> = {
  ok: '✓',
  error: '✕',
  skipped: '↷',
  pending: '•',
}

const STEP_STATUS_COLOR: Record<string, string> = {
  ok: 'text-green-600',
  error: 'text-red-600',
  skipped: 'text-gray-400',
  pending: 'text-blue-500',
}

interface Props {
  tenantId: string
}

export function History({ tenantId }: Props) {
  const [executions, setExecutions] = useState<ExecutionRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [phoneFilter, setPhoneFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [detail, setDetail] = useState<ExecutionRow | null>(null)

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const result = await fetchExecutions(tenantId, {
        phone: phoneFilter || undefined,
        status: statusFilter || undefined,
        limit: 100,
      })
      setExecutions(result.executions || [])
      setTotal(result.total || 0)
    } catch (err: any) {
      console.error('Falha ao carregar execuções', err)
    } finally {
      setLoading(false)
    }
  }, [tenantId, phoneFilter, statusFilter])

  useEffect(() => {
    load()
  }, [load])

  const toggleExpand = async (id: string) => {
    if (expanded === id) {
      setExpanded(null)
      setDetail(null)
      return
    }
    setExpanded(id)
    setDetail(null)
    try {
      const ex = await fetchExecution(tenantId, id)
      setDetail(ex)
    } catch (err) {
      console.error('Falha ao carregar detalhe', err)
    }
  }

  const fmtTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const fmtDuration = (ms: number | null) => {
    if (!ms) return '-'
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-800">Histórico de execuções</h1>
            <p className="text-xs text-gray-400">{total} execuções no banco {phoneFilter && `· filtrando "${phoneFilter}"`}</p>
          </div>
          <button
            onClick={load}
            className="text-xs px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-600"
          >
            ↻ Atualizar
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="shrink-0 px-6 py-3 border-b border-gray-200 bg-gray-50 flex items-center gap-2 flex-wrap">
        <input
          type="text"
          value={phoneFilter}
          onChange={(e) => setPhoneFilter(e.target.value.replace(/\D/g, ''))}
          placeholder="Filtrar por telefone (ex: 558688720061)"
          className="text-xs px-3 py-1.5 rounded border border-gray-300 bg-white w-64 font-mono"
        />
        {phoneFilter && (
          <button onClick={() => setPhoneFilter('')} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
        )}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs px-2 py-1.5 rounded border border-gray-300 bg-white"
        >
          <option value="">Todos os status</option>
          <option value="running">Running</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
          <option value="deferred">Deferred</option>
        </select>
        <span className="text-[10px] text-gray-400 ml-auto">{executions.length} carregadas</span>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="px-6 py-8 text-center text-gray-300 text-sm">Carregando…</div>
        )}
        {!loading && executions.length === 0 && (
          <div className="px-6 py-12 text-center text-gray-300 text-sm">
            Nenhuma execução encontrada {phoneFilter && `para "${phoneFilter}"`}
          </div>
        )}
        {!loading && executions.map((ex) => {
          const isOpen = expanded === ex.id
          return (
            <div key={ex.id} className="border-b border-gray-100 hover:bg-gray-50">
              <button
                onClick={() => toggleExpand(ex.id)}
                className="w-full px-6 py-3 flex items-center gap-3 text-left"
              >
                <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${STATUS_COLOR[ex.status] || 'bg-gray-100'}`}>
                  {ex.status}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-700 truncate">{ex.flowAlias || ex.flowId}</div>
                  <div className="text-[11px] text-gray-400 flex items-center gap-2 mt-0.5">
                    <span className="font-mono">{ex.phone || '?'}</span>
                    <span>·</span>
                    <span>{ex.customerName || '?'}</span>
                    <span>·</span>
                    <span>{fmtTime(ex.startedAt)}</span>
                    {ex.durationMs && <><span>·</span><span>{fmtDuration(ex.durationMs)}</span></>}
                  </div>
                </div>
                <span className="text-xs text-gray-300">{isOpen ? '▼' : '▶'}</span>
              </button>

              {isOpen && (
                <div className="px-6 pb-4 pt-1 bg-gray-50/50 border-t border-gray-100">
                  {!detail && <div className="text-xs text-gray-300">Carregando detalhe…</div>}
                  {detail && detail.id === ex.id && (
                    <div className="space-y-3">
                      {detail.error && (
                        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 font-mono whitespace-pre-wrap">
                          {detail.error}
                        </div>
                      )}
                      <div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Steps ({detail.steps?.length || 0})</div>
                        <div className="space-y-1">
                          {detail.steps?.map((s, i) => (
                            <div key={i} className="text-xs flex items-center gap-2 px-2 py-1 rounded bg-white border border-gray-100">
                              <span className={`font-bold ${STEP_STATUS_COLOR[s.status]}`}>{STEP_STATUS_ICON[s.status]}</span>
                              <span className="font-mono text-gray-500 w-32 truncate">{s.type}</span>
                              <span className="flex-1 text-gray-700 truncate">{s.label || ''}</span>
                              {s.durationMs !== undefined && <span className="text-gray-400">{s.durationMs}ms</span>}
                              {s.error && <span className="text-red-500 truncate max-w-xs">{s.error}</span>}
                            </div>
                          ))}
                          {(!detail.steps || detail.steps.length === 0) && (
                            <div className="text-xs text-gray-300 italic">Sem steps registrados</div>
                          )}
                        </div>
                      </div>
                      {detail.webhookPayload && (
                        <details>
                          <summary className="text-[10px] font-bold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600">Webhook payload</summary>
                          <pre className="text-[10px] font-mono text-gray-600 bg-white border border-gray-100 rounded p-2 mt-1 overflow-x-auto">
                            {JSON.stringify(detail.webhookPayload, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
