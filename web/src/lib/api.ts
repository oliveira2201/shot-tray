const BASE = '/api'

export async function fetchTenants(): Promise<string[]> {
  const res = await fetch(`${BASE}/tenants`)
  return res.json()
}

export async function fetchFlows(tenantId: string): Promise<string[]> {
  const res = await fetch(`${BASE}/flows/${tenantId}`)
  return res.json()
}

export async function fetchFlow(tenantId: string, flowId: string) {
  const res = await fetch(`${BASE}/flows/${tenantId}/${flowId}`)
  return res.json()
}

export async function saveFlow(tenantId: string, flowId: string, flow: unknown) {
  const res = await fetch(`${BASE}/flows/${tenantId}/${flowId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(flow),
  })
  return res.json()
}

export async function createFlow(tenantId: string, flowId: string, flow: unknown) {
  const res = await fetch(`${BASE}/flows/${tenantId}/${flowId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(flow),
  })
  return res.json()
}

export async function deleteFlow(tenantId: string, flowId: string) {
  const res = await fetch(`${BASE}/flows/${tenantId}/${flowId}`, { method: 'DELETE' })
  return res.json()
}

export async function fetchConfig(tenantId: string) {
  const res = await fetch(`${BASE}/config/${tenantId}`)
  return res.json()
}

export async function saveConfig(tenantId: string, config: unknown) {
  const res = await fetch(`${BASE}/config/${tenantId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
  return res.json()
}

export async function fetchOverview(tenantId: string) {
  const res = await fetch(`${BASE}/overview/${tenantId}`)
  const text = await res.text()
  try { return JSON.parse(text) } catch { return { error: `Resposta inválida (status ${res.status}). Reinicie o servidor.` } }
}

export async function fetchTemplates(tenantId: string) {
  const res = await fetch(`${BASE}/templates/${tenantId}`)
  return res.json()
}

export async function saveTemplate(tenantId: string, type: string, key: string, value: unknown) {
  const res = await fetch(`${BASE}/templates/${tenantId}/${type}/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  })
  return res.json()
}

export async function simulateFlow(tenantId: string, flowId: string, body: unknown) {
  const res = await fetch(`${BASE}/simulate/${tenantId}/${flowId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

export async function syncTags(tenantId: string, jwtToken: string) {
  const res = await fetch(`${BASE}/tags/${tenantId}/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jwtToken }),
  })
  return res.json()
}

export async function fetchTagsStatus(tenantId: string) {
  const res = await fetch(`${BASE}/tags/${tenantId}/status`)
  return res.json()
}

// Scheduler / Monitor
export async function fetchSchedulerJobs() {
  const res = await fetch(`${BASE}/scheduler/jobs`)
  return res.json()
}

export async function fetchSchedulerLogs(limit = 100) {
  const res = await fetch(`${BASE}/scheduler/logs?limit=${limit}`)
  return res.json()
}

export async function fetchSchedulerStats() {
  const res = await fetch(`${BASE}/scheduler/stats`)
  return res.json()
}

export async function cancelSchedulerJob(jobId: string) {
  const res = await fetch(`${BASE}/scheduler/jobs/${jobId}`, { method: 'DELETE' })
  return res.json()
}

// Histórico de execuções (tabela executions do Postgres)
export async function fetchExecutions(
  tenantId: string,
  opts: { phone?: string; status?: string; flowId?: string; limit?: number; offset?: number } = {}
) {
  const params = new URLSearchParams()
  if (opts.phone) params.set('phone', opts.phone)
  if (opts.status) params.set('status', opts.status)
  if (opts.flowId) params.set('flowId', opts.flowId)
  if (opts.limit) params.set('limit', String(opts.limit))
  if (opts.offset) params.set('offset', String(opts.offset))
  const qs = params.toString()
  const res = await fetch(`${BASE}/executions/${tenantId}${qs ? '?' + qs : ''}`)
  return res.json()
}

export async function fetchExecution(tenantId: string, executionId: string) {
  const res = await fetch(`${BASE}/executions/${tenantId}/${executionId}`)
  return res.json()
}
