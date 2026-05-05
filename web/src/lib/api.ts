import { getAccessToken } from '../auth/oidc'

const BASE = '/api/admin'

async function authedFetch(input: RequestInfo, init: RequestInit = {}) {
  const token = await getAccessToken()
  return fetch(input, {
    ...init,
    headers: {
      ...(init.headers || {}),
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
}

export async function fetchTenants(): Promise<string[]> {
  const res = await authedFetch(`${BASE}/tenants`)
  return res.json()
}

export async function fetchFlows(tenantId: string): Promise<string[]> {
  const res = await authedFetch(`${BASE}/flows/${tenantId}`)
  return res.json()
}

export async function fetchFlow(tenantId: string, flowId: string) {
  const res = await authedFetch(`${BASE}/flows/${tenantId}/${flowId}`)
  return res.json()
}

export async function saveFlow(tenantId: string, flowId: string, flow: unknown) {
  const res = await authedFetch(`${BASE}/flows/${tenantId}/${flowId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(flow),
  })
  return res.json()
}

export async function createFlow(tenantId: string, flowId: string, flow: unknown) {
  const res = await authedFetch(`${BASE}/flows/${tenantId}/${flowId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(flow),
  })
  return res.json()
}

export async function deleteFlow(tenantId: string, flowId: string) {
  const res = await authedFetch(`${BASE}/flows/${tenantId}/${flowId}`, { method: 'DELETE' })
  return res.json()
}

export async function fetchConfig(tenantId: string) {
  const res = await authedFetch(`${BASE}/config/${tenantId}`)
  return res.json()
}

export async function saveConfig(tenantId: string, config: unknown) {
  const res = await authedFetch(`${BASE}/config/${tenantId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
  return res.json()
}

export async function fetchOverview(tenantId: string) {
  const res = await authedFetch(`${BASE}/overview/${tenantId}`)
  const text = await res.text()
  try { return JSON.parse(text) } catch { return { error: `Resposta inválida (status ${res.status}). Reinicie o servidor.` } }
}

export async function fetchTemplates(tenantId: string) {
  const res = await authedFetch(`${BASE}/templates/${tenantId}`)
  return res.json()
}

export async function saveTemplate(tenantId: string, type: string, key: string, value: unknown) {
  const res = await authedFetch(`${BASE}/templates/${tenantId}/${type}/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  })
  return res.json()
}

export async function simulateFlow(tenantId: string, flowId: string, body: unknown) {
  const res = await authedFetch(`${BASE}/simulate/${tenantId}/${flowId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

export async function syncTags(tenantId: string, jwtToken: string) {
  const res = await authedFetch(`${BASE}/tags/${tenantId}/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jwtToken }),
  })
  return res.json()
}

export async function fetchTagsStatus(tenantId: string) {
  const res = await authedFetch(`${BASE}/tags/${tenantId}/status`)
  return res.json()
}

// Scheduler / Monitor
export async function fetchSchedulerJobs() {
  const res = await authedFetch(`${BASE}/scheduler/jobs`)
  return res.json()
}

export async function fetchSchedulerLogs(limit = 100) {
  const res = await authedFetch(`${BASE}/scheduler/logs?limit=${limit}`)
  return res.json()
}

export async function fetchSchedulerStats() {
  const res = await authedFetch(`${BASE}/scheduler/stats`)
  return res.json()
}

export async function cancelSchedulerJob(jobId: string) {
  const res = await authedFetch(`${BASE}/scheduler/jobs/${jobId}`, { method: 'DELETE' })
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
  const res = await authedFetch(`${BASE}/executions/${tenantId}${qs ? '?' + qs : ''}`)
  return res.json()
}

export async function fetchExecution(tenantId: string, executionId: string) {
  const res = await authedFetch(`${BASE}/executions/${tenantId}/${executionId}`)
  return res.json()
}

// ----------------------------------------------------------------------------
// Admin Tenants (Tasks 18 / 19)
// ----------------------------------------------------------------------------

export async function listAdminTenants() {
  const res = await authedFetch(`${BASE}/tenants`)
  return res.json()
}

export async function getAdminTenant(id: string) {
  const res = await authedFetch(`${BASE}/tenants/${id}`)
  if (!res.ok) {
    if (res.status === 404) return null
    throw new Error(`Falha ao carregar tenant (HTTP ${res.status})`)
  }
  return res.json()
}

export async function saveAdminTenant(tenant: any) {
  // Try GET to detect if tenant already exists; if exists -> PUT, else POST
  const exists = (await authedFetch(`${BASE}/tenants/${tenant.id}`)).status === 200
  const method = exists ? 'PUT' : 'POST'
  const url = exists ? `${BASE}/tenants/${tenant.id}` : `${BASE}/tenants`
  const res = await authedFetch(url, { method, body: JSON.stringify(tenant) })
  if (!res.ok) throw new Error(`Falha ao salvar (HTTP ${res.status}): ${await res.text()}`)
  return res.json()
}

export async function deleteAdminTenant(id: string) {
  const res = await authedFetch(`${BASE}/tenants/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Falha ao desativar (HTTP ${res.status})`)
}

// Adapters/providers schema
export async function getAdaptersSchema() {
  const res = await authedFetch(`${BASE}/adapters`)
  return res.json()
}

export async function getProvidersSchema() {
  const res = await authedFetch(`${BASE}/providers`)
  return res.json()
}

// Templates admin
export async function listAdminTemplates(tenantId: string) {
  const res = await authedFetch(`${BASE}/tenants/${tenantId}/templates`)
  return res.json()
}

export async function saveAdminTemplate(
  tenantId: string,
  t: { kind: string; key: string; content: unknown }
) {
  const res = await authedFetch(`${BASE}/tenants/${tenantId}/templates`, {
    method: 'POST',
    body: JSON.stringify(t),
  })
  if (!res.ok) throw new Error(`Falha ao salvar template (HTTP ${res.status})`)
  return res.json()
}

export async function deleteAdminTemplate(tenantId: string, kind: string, key: string) {
  const res = await authedFetch(`${BASE}/tenants/${tenantId}/templates/${kind}/${key}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error(`Falha ao deletar template`)
}

// Flows admin (paralelo aos endpoints existentes; usa a base /tenants/:id/flows)
export async function listAdminFlows(tenantId: string) {
  const res = await authedFetch(`${BASE}/tenants/${tenantId}/flows`)
  return res.json()
}

export async function getAdminFlow(tenantId: string, slug: string) {
  const res = await authedFetch(`${BASE}/tenants/${tenantId}/flows/${slug}`)
  return res.json()
}

export async function saveAdminFlow(tenantId: string, flow: unknown) {
  const res = await authedFetch(`${BASE}/tenants/${tenantId}/flows`, {
    method: 'POST',
    body: JSON.stringify(flow),
  })
  if (!res.ok) throw new Error(`Falha ao salvar flow`)
  return res.json()
}

export async function deleteAdminFlow(tenantId: string, slug: string) {
  const res = await authedFetch(`${BASE}/tenants/${tenantId}/flows/${slug}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error(`Falha ao deletar flow`)
}

// OAuth Tray
export async function getOAuthTrayStatus(tenantId: string) {
  const res = await authedFetch(`${BASE}/tenants/${tenantId}/oauth/tray/status`)
  return res.json()
}

export async function completeOAuthTray(tenantId: string, payload: unknown) {
  const res = await authedFetch(`${BASE}/tenants/${tenantId}/oauth/tray/complete`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Falha ao salvar OAuth (HTTP ${res.status})`)
  return res.json()
}

export async function refreshOAuthTrayNow(tenantId: string) {
  const res = await authedFetch(`${BASE}/tenants/${tenantId}/oauth/tray/refresh-now`, {
    method: 'POST',
  })
  return res.json()
}
