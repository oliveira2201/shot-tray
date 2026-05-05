import { useEffect, useState } from 'react'
import {
  getAdminTenant,
  getAdaptersSchema,
  getProvidersSchema,
  saveAdminTenant,
  deleteAdminTenant,
} from '../../lib/api'

interface Field {
  name: string
  label: string
  type: string
  required?: boolean
  default?: string
  help?: string
}

interface Schema {
  type: string
  label: string
  fields: Field[]
  requiresOAuth?: boolean
}

function getNested(cfg: Record<string, any>, path: string): any {
  return path.split('.').reduce<any>((o, k) => (o == null ? o : o[k]), cfg)
}

function setNested(cfg: Record<string, any>, path: string, value: any): Record<string, any> {
  const parts = path.split('.')
  const next: Record<string, any> = { ...cfg }
  let cur: Record<string, any> = next
  for (let i = 0; i < parts.length - 1; i++) {
    cur[parts[i]] = { ...(cur[parts[i]] || {}) }
    cur = cur[parts[i]]
  }
  cur[parts[parts.length - 1]] = value
  return next
}

export function ConfigTab({
  tenantId,
  onAdapterTypeChange,
}: {
  tenantId: string
  onAdapterTypeChange: (t: string | null) => void
}) {
  const [tenant, setTenant] = useState<any>(null)
  const [adapters, setAdapters] = useState<Schema[]>([])
  const [providers, setProviders] = useState<Schema[]>([])
  const [adapterCfg, setAdapterCfg] = useState<Record<string, any>>({})
  const [providerCfg, setProviderCfg] = useState<Record<string, any>>({})
  const [adapterType, setAdapterType] = useState('default')
  const [providerType, setProviderType] = useState('shotzap')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      getAdminTenant(tenantId).catch(() => null),
      getAdaptersSchema(),
      getProvidersSchema(),
    ]).then(([t, a, p]) => {
      setAdapters(Array.isArray(a) ? a : [])
      setProviders(Array.isArray(p) ? p : [])
      if (t) {
        setTenant(t)
        setName(t.name || '')
        setAdapterType(t.adapterType || 'default')
        setProviderType(t.providerType || 'shotzap')
        setAdapterCfg(t.adapterConfig || {})
        setProviderCfg(t.providerConfig || {})
        onAdapterTypeChange(t.adapterType || 'default')
      } else {
        onAdapterTypeChange('default')
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  const handleAdapterChange = (t: string) => {
    setAdapterType(t)
    onAdapterTypeChange(t)
  }

  const handleSave = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const providerConfigOut: Record<string, any> = {
        baseUrl: providerCfg.baseUrl || '',
        token: providerCfg.token || '',
        paths: providerCfg.paths || {},
      }
      if (providerCfg.tagsCachePath) providerConfigOut.tagsCachePath = providerCfg.tagsCachePath

      await saveAdminTenant({
        id: tenantId,
        name,
        status: 'active',
        adapterType,
        providerType,
        adapterConfig: adapterCfg,
        providerConfig: providerConfigOut,
      })
      setMsg('Salvo!')
      // Re-fetch para refletir versão persistida
      const t = await getAdminTenant(tenantId).catch(() => null)
      if (t) setTenant(t)
    } catch (err: any) {
      setMsg(`Erro: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Desativar tenant "${tenantId}"?`)) return
    try {
      await deleteAdminTenant(tenantId)
      setMsg('Tenant desativado')
    } catch (err: any) {
      setMsg(`Erro: ${err.message}`)
    }
  }

  const adapter = adapters.find((a) => a.type === adapterType)
  const provider = providers.find((p) => p.type === providerType)

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <label className="block text-sm font-semibold mb-1">Nome</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold mb-1">Tipo de Adapter</label>
        <select
          value={adapterType}
          onChange={(e) => handleAdapterChange(e.target.value)}
          className="border rounded px-3 py-2 text-sm"
        >
          {adapters.map((a) => (
            <option key={a.type} value={a.type}>
              {a.label}
            </option>
          ))}
        </select>
      </div>
      {adapter &&
        adapter.fields.map((f) => (
          <div key={f.name}>
            <label className="block text-sm font-semibold mb-1">
              {f.label}
              {f.required && ' *'}
            </label>
            <input
              type={f.type === 'url' ? 'url' : 'text'}
              value={getNested(adapterCfg, f.name) ?? f.default ?? ''}
              onChange={(e) =>
                setAdapterCfg(setNested(adapterCfg, f.name, e.target.value))
              }
              className="w-full border rounded px-3 py-2 text-sm"
            />
            {f.help && <p className="text-xs text-gray-400 mt-0.5">{f.help}</p>}
          </div>
        ))}
      <div>
        <label className="block text-sm font-semibold mb-1">Tipo de Provider</label>
        <select
          value={providerType}
          onChange={(e) => setProviderType(e.target.value)}
          className="border rounded px-3 py-2 text-sm"
        >
          {providers.map((p) => (
            <option key={p.type} value={p.type}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      {provider &&
        provider.fields.map((f) => (
          <div key={f.name}>
            <label className="block text-sm font-semibold mb-1">
              {f.label}
              {f.required && ' *'}
            </label>
            <input
              type={
                f.type === 'url'
                  ? 'url'
                  : f.type === 'password'
                  ? 'password'
                  : 'text'
              }
              value={getNested(providerCfg, f.name) ?? f.default ?? ''}
              onChange={(e) =>
                setProviderCfg(setNested(providerCfg, f.name, e.target.value))
              }
              className="w-full border rounded px-3 py-2 text-sm"
            />
            {f.help && <p className="text-xs text-gray-400 mt-0.5">{f.help}</p>}
          </div>
        ))}
      <div className="flex gap-2 pt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-5 py-2 rounded text-sm"
        >
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
        {tenant && (
          <button
            onClick={handleDelete}
            className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-2 rounded text-sm"
          >
            Desativar
          </button>
        )}
        {msg && <span className="text-sm self-center">{msg}</span>}
      </div>
    </div>
  )
}
