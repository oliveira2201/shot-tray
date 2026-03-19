import { useEffect, useState } from 'react'
import { fetchConfig, saveConfig, fetchTagsStatus, syncTags } from '../lib/api'

interface Props {
  tenantId: string
}

interface TagStatus {
  flowTags: string[]
  shotzapTags: { id: number; name: string }[]
  missing: string[]
  extra: { id: number; name: string }[]
}

interface SyncResult {
  message: string
  created: { name: string; id: number }[]
  errors: { name: string; error: string }[]
}

export function SettingsPanel({ tenantId }: Props) {
  const [config, setConfig] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Tags
  const [tagStatus, setTagStatus] = useState<TagStatus | null>(null)
  const [tagLoading, setTagLoading] = useState(false)
  const [jwtInput, setJwtInput] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)

  useEffect(() => {
    fetchConfig(tenantId).then(setConfig)
  }, [tenantId])

  if (!config) return <div className="p-4 text-gray-400 text-sm">Carregando...</div>

  const updateField = (path: string, value: string) => {
    const keys = path.split('.')
    const next = JSON.parse(JSON.stringify(config))
    let obj = next
    for (let i = 0; i < keys.length - 1; i++) {
      obj = obj[keys[i]] = obj[keys[i]] || {}
    }
    obj[keys[keys.length - 1]] = value
    setConfig(next)
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    await saveConfig(tenantId, config)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleCheckTags = async () => {
    setTagLoading(true)
    setSyncResult(null)
    try {
      const status = await fetchTagsStatus(tenantId)
      setTagStatus(status)
    } catch {
      setTagStatus(null)
    }
    setTagLoading(false)
  }

  const handleSyncTags = async () => {
    if (!jwtInput.trim()) return
    setSyncing(true)
    setSyncResult(null)
    try {
      const result = await syncTags(tenantId, jwtInput.trim())
      setSyncResult(result)
      // Recarregar status
      const status = await fetchTagsStatus(tenantId)
      setTagStatus(status)
    } catch (err: any) {
      setSyncResult({ message: `Erro: ${err.message}`, created: [], errors: [] })
    }
    setSyncing(false)
  }

  return (
    <div className="p-6 max-w-2xl overflow-y-auto h-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-800">Configuracoes: {config.name || tenantId}</h2>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 rounded text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 transition-colors"
        >
          {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar'}
        </button>
      </div>

      <Section title="Geral">
        <Field label="Nome do Tenant">
          <input value={config.name || ''} onChange={(e) => updateField('name', e.target.value)} className="input-field" />
        </Field>
        <Field label="Integracao (ERP)">
          <select value={config.inputAdapter || 'default'} onChange={(e) => updateField('inputAdapter', e.target.value)} className="input-field">
            <option value="default">Generico (Default)</option>
            <option value="nuvemshop">Nuvemshop</option>
            <option value="tray">Tray</option>
          </select>
        </Field>
        <Field label="Canal de saida">
          <select value={config.outputProvider || 'shotzap'} onChange={(e) => updateField('outputProvider', e.target.value)} className="input-field">
            <option value="shotzap">Shotzap</option>
          </select>
        </Field>
      </Section>

      <Section title="Webhook">
        <Field label="URL do Webhook">
          <div className="flex items-center gap-2">
            <input value={`/webhooks/${tenantId}`} readOnly className="input-field font-mono text-xs bg-gray-100" />
            <button
              onClick={() => navigator.clipboard.writeText(`${window.location.origin}/webhooks/${tenantId}`)}
              className="shrink-0 px-2 py-1.5 rounded text-xs bg-gray-200 hover:bg-gray-300 transition-colors"
              title="Copiar URL completa"
            >
              Copiar
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">Configure esta URL no painel da Nuvemshop/Tray para receber eventos</p>
        </Field>
      </Section>

      <Section title="Shotzap API">
        <Field label="Base URL">
          <input value={config.config?.baseUrl || ''} onChange={(e) => updateField('config.baseUrl', e.target.value)} className="input-field" />
        </Field>
        <Field label="Token API">
          <input value={config.config?.token || ''} onChange={(e) => updateField('config.token', e.target.value)} className="input-field font-mono text-xs" />
          <p className="text-[10px] text-gray-400 mt-1">Token da conexao Shotzap (ex: felipe01). Usado para envio de mensagens e tags.</p>
        </Field>
      </Section>

      <Section title="Endpoints">
        <Field label="Enviar Texto">
          <input value={config.config?.paths?.sendText || '/api/messages/send'} onChange={(e) => updateField('config.paths.sendText', e.target.value)} className="input-field font-mono text-xs" />
        </Field>
        <Field label="Adicionar Tag">
          <input value={config.config?.paths?.addTag || '/api/tags/add'} onChange={(e) => updateField('config.paths.addTag', e.target.value)} className="input-field font-mono text-xs" />
        </Field>
        <Field label="Enviar Botoes">
          <input value={config.config?.paths?.sendButtons || '/api/messages/whatsmeow/sendButtonsPRO'} onChange={(e) => updateField('config.paths.sendButtons', e.target.value)} className="input-field font-mono text-xs" />
        </Field>
      </Section>

      <Section title="Tags na Shotzap">
        <div className="mb-3">
          <button
            onClick={handleCheckTags}
            disabled={tagLoading}
            className="px-3 py-1.5 rounded text-sm bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors disabled:opacity-40"
          >
            {tagLoading ? 'Verificando...' : 'Verificar Tags'}
          </button>
          <p className="text-[10px] text-gray-400 mt-1">Compara as tags dos flows com as que existem na Shotzap</p>
        </div>

        {tagStatus && (
          <div className="mb-4 space-y-3">
            {/* Resumo */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-blue-50 rounded p-2">
                <div className="text-lg font-bold text-blue-600">{tagStatus.flowTags.length}</div>
                <div className="text-[10px] text-blue-400">Nos flows</div>
              </div>
              <div className="bg-green-50 rounded p-2">
                <div className="text-lg font-bold text-green-600">{tagStatus.shotzapTags.length}</div>
                <div className="text-[10px] text-green-400">Na Shotzap</div>
              </div>
              <div className={`rounded p-2 ${tagStatus.missing.length > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                <div className={`text-lg font-bold ${tagStatus.missing.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {tagStatus.missing.length}
                </div>
                <div className={`text-[10px] ${tagStatus.missing.length > 0 ? 'text-red-400' : 'text-green-400'}`}>Faltando</div>
              </div>
            </div>

            {/* Tags faltando */}
            {tagStatus.missing.length > 0 && (
              <div>
                <div className="text-xs font-medium text-red-500 mb-1">Tags que precisam ser criadas:</div>
                <div className="flex flex-wrap gap-1">
                  {tagStatus.missing.map(t => (
                    <span key={t} className="px-2 py-0.5 rounded text-xs bg-red-50 text-red-600 border border-red-200">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Tags OK */}
            {tagStatus.missing.length === 0 && (
              <div className="text-sm text-green-600 flex items-center gap-1">
                Todas as tags estao sincronizadas!
              </div>
            )}

            {/* Criar tags faltantes */}
            {tagStatus.missing.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="text-xs font-medium text-yellow-700 mb-2">
                  Criar tags faltantes na Shotzap
                </div>
                <p className="text-[10px] text-yellow-600 mb-2">
                  Cole o token JWT ou um curl copiado do DevTools do navegador. O sistema extrai o token automaticamente.
                </p>
                <textarea
                  value={jwtInput}
                  onChange={(e) => setJwtInput(e.target.value)}
                  placeholder="Cole aqui o JWT token ou curl completo..."
                  className="w-full px-2 py-1.5 rounded border border-yellow-300 text-xs font-mono resize-none bg-white"
                  rows={3}
                />
                <button
                  onClick={handleSyncTags}
                  disabled={syncing || !jwtInput.trim()}
                  className="mt-2 px-3 py-1.5 rounded text-sm font-medium bg-yellow-500 text-white hover:bg-yellow-400 disabled:opacity-40 transition-colors"
                >
                  {syncing ? 'Criando tags...' : `Criar ${tagStatus.missing.length} tag(s)`}
                </button>
              </div>
            )}

            {/* Resultado do sync */}
            {syncResult && (
              <div className={`rounded-lg p-3 text-sm ${syncResult.errors?.length > 0 ? 'bg-orange-50 border border-orange-200' : 'bg-green-50 border border-green-200'}`}>
                <div className="font-medium mb-1">{syncResult.message}</div>
                {syncResult.created?.length > 0 && (
                  <div className="text-xs text-green-600">
                    Criadas: {syncResult.created.map(c => c.name).join(', ')}
                  </div>
                )}
                {syncResult.errors?.length > 0 && (
                  <div className="text-xs text-red-500 mt-1">
                    Erros: {syncResult.errors.map(e => `${e.name} (${e.error})`).join(', ')}
                  </div>
                )}
              </div>
            )}

            {/* Lista completa */}
            <details className="text-xs">
              <summary className="text-gray-400 cursor-pointer hover:text-gray-600">Ver todas as tags ({tagStatus.shotzapTags.length} na Shotzap)</summary>
              <div className="mt-2 flex flex-wrap gap-1">
                {tagStatus.shotzapTags.map(t => (
                  <span key={t.id} className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">
                    {t.name} <span className="text-gray-300">#{t.id}</span>
                  </span>
                ))}
              </div>
            </details>
          </div>
        )}
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-200 pb-1">{title}</h3>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  )
}
