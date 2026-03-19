import { useEffect, useState, useCallback } from 'react'
import { fetchSchedulerJobs, fetchSchedulerLogs, fetchSchedulerStats, cancelSchedulerJob } from '../lib/api'

interface Job {
  id: string
  tenantId: string
  flowAlias: string
  status: string
  executeAt: number
  executeIn: string
  phone: string
  cancelIfTags: string[]
  stepsCount: number
  createdAt: number
}

interface LogEntry {
  id: string
  timestamp: number
  type: string
  tenantId: string
  flowAlias?: string
  phone?: string
  detail?: string
  jobId?: string
}

const LOG_TYPE_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  webhook_received: { label: 'Webhook', icon: '📥', color: '#3b82f6', bg: '#eff6ff' },
  flow_started: { label: 'Flow Iniciado', icon: '▶️', color: '#8b5cf6', bg: '#f5f3ff' },
  flow_completed: { label: 'Flow OK', icon: '✅', color: '#22c55e', bg: '#f0fdf4' },
  flow_error: { label: 'Flow Erro', icon: '❌', color: '#ef4444', bg: '#fef2f2' },
  job_scheduled: { label: 'Agendado', icon: '⏰', color: '#f59e0b', bg: '#fffbeb' },
  job_executed: { label: 'Executado', icon: '⚡', color: '#22c55e', bg: '#f0fdf4' },
  job_cancelled: { label: 'Cancelado', icon: '🚫', color: '#6b7280', bg: '#f9fafb' },
  job_error: { label: 'Job Erro', icon: '💥', color: '#ef4444', bg: '#fef2f2' },
}

export function Monitor() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [stats, setStats] = useState<Record<string, string>>({})
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [phoneFilter, setPhoneFilter] = useState('')

  const refresh = useCallback(async () => {
    try {
      const [j, l, s] = await Promise.all([
        fetchSchedulerJobs(),
        fetchSchedulerLogs(200),
        fetchSchedulerStats(),
      ])
      setJobs(j.jobs || [])
      setLogs(l.logs || [])
      setStats(s || {})
    } catch {}
  }, [])

  useEffect(() => {
    refresh()
    if (!autoRefresh) return
    const interval = setInterval(refresh, 5000)
    return () => clearInterval(interval)
  }, [autoRefresh, refresh])

  const handleCancel = async (jobId: string) => {
    await cancelSchedulerJob(jobId)
    refresh()
  }

  const filteredLogs = logs.filter(l => {
    if (filter !== 'all' && l.type !== filter) return false
    if (phoneFilter && !l.phone?.includes(phoneFilter)) return false
    return true
  })

  const uniquePhones = [...new Set(logs.map(l => l.phone).filter(Boolean))]

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">Monitor</h1>
            <p className="text-xs text-gray-400">Webhooks, flows e jobs em tempo real</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={refresh} className="px-3 py-1.5 rounded text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors">
              Atualizar
            </button>
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="rounded" />
              Auto (5s)
            </label>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-2 mt-3 flex-wrap">
          <StatBadge label="Webhooks" value={stats.webhook_received || '0'} color="#3b82f6" />
          <StatBadge label="Flows OK" value={stats.flow_completed || '0'} color="#22c55e" />
          <StatBadge label="Erros" value={String(Number(stats.flow_error || 0) + Number(stats.job_error || 0))} color="#ef4444" />
          <StatBadge label="Jobs Agendados" value={stats.job_scheduled || '0'} color="#f59e0b" />
          <StatBadge label="Jobs Executados" value={stats.job_executed || '0'} color="#8b5cf6" />
          <StatBadge label="Jobs Cancelados" value={stats.job_cancelled || '0'} color="#6b7280" />
          <StatBadge label="Pendentes" value={String(jobs.length)} color={jobs.length > 0 ? '#f59e0b' : '#22c55e'} />
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Jobs pendentes */}
        <div className="w-80 border-r border-gray-200 flex flex-col overflow-hidden bg-gray-50">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Jobs Pendentes ({jobs.length})
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {jobs.length === 0 && (
              <div className="px-4 py-8 text-center text-gray-300 text-sm">Nenhum job pendente</div>
            )}
            {jobs.map((job) => (
              <div key={job.id} className="px-4 py-3 border-b border-gray-100 hover:bg-white transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-700 truncate">{job.flowAlias}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    job.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    job.status === 'running' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {job.status}
                  </span>
                </div>
                <div className="text-[10px] text-gray-400 space-y-0.5">
                  <div className="flex items-center gap-1">
                    <span>📱</span>
                    <span className="font-mono">{job.phone || '?'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span>⏱️</span>
                    <span>Executa em <strong className="text-gray-600">{job.executeIn}</strong></span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span>📋</span>
                    <span>{job.stepsCount} steps restantes</span>
                  </div>
                  {job.cancelIfTags?.length > 0 && (
                    <div className="flex items-center gap-1">
                      <span>🚫</span>
                      <span className="truncate">Cancela se: {job.cancelIfTags.join(', ')}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] font-mono text-gray-300 truncate" title={job.id}>{job.id.slice(0, 8)}</span>
                  <button onClick={() => handleCancel(job.id)} className="text-[10px] text-red-400 hover:text-red-600 px-1.5 py-0.5 rounded hover:bg-red-50">
                    Cancelar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Logs */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Filtros */}
          <div className="shrink-0 px-4 py-2 border-b border-gray-200 bg-gray-50 flex items-center gap-2 flex-wrap">
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="text-xs px-2 py-1 rounded border border-gray-300 bg-white">
              <option value="all">Todos os tipos</option>
              {Object.entries(LOG_TYPE_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.icon} {cfg.label}</option>
              ))}
            </select>
            <select value={phoneFilter} onChange={(e) => setPhoneFilter(e.target.value)} className="text-xs px-2 py-1 rounded border border-gray-300 bg-white">
              <option value="">Todos os telefones</option>
              {uniquePhones.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <span className="text-[10px] text-gray-400 ml-auto">{filteredLogs.length} eventos</span>
          </div>

          {/* Lista de logs */}
          <div className="flex-1 overflow-y-auto">
            {filteredLogs.length === 0 && (
              <div className="px-6 py-12 text-center text-gray-300 text-sm">
                {logs.length === 0 ? 'Nenhum evento registrado. Envie um webhook para começar.' : 'Nenhum evento com esses filtros.'}
              </div>
            )}
            {filteredLogs.map((log) => {
              const cfg = LOG_TYPE_CONFIG[log.type] || { label: log.type, icon: '?', color: '#6b7280', bg: '#f9fafb' }
              const time = new Date(log.timestamp)
              const timeStr = time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              const dateStr = time.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

              return (
                <div key={log.id} className="px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50 transition-colors flex items-start gap-3">
                  {/* Timestamp */}
                  <div className="shrink-0 w-16 text-right">
                    <div className="text-[10px] font-mono text-gray-400">{timeStr}</div>
                    <div className="text-[10px] font-mono text-gray-300">{dateStr}</div>
                  </div>

                  {/* Type badge */}
                  <div className="shrink-0 mt-0.5">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                      style={{ backgroundColor: cfg.bg, color: cfg.color }}
                    >
                      <span>{cfg.icon}</span>
                      {cfg.label}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {log.flowAlias && (
                        <span className="text-xs font-medium text-gray-700">{log.flowAlias}</span>
                      )}
                      {log.phone && (
                        <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{log.phone}</span>
                      )}
                      <span className="text-[10px] text-gray-300">{log.tenantId}</span>
                    </div>
                    {log.detail && (
                      <p className="text-[10px] text-gray-500 mt-0.5 break-all leading-relaxed">{log.detail}</p>
                    )}
                    {log.jobId && (
                      <span className="text-[10px] font-mono text-gray-300 mt-0.5 inline-block">job:{log.jobId.slice(0, 8)}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatBadge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100">
      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[10px] text-gray-500">{label}</span>
      <span className="text-xs font-bold" style={{ color }}>{value}</span>
    </div>
  )
}
