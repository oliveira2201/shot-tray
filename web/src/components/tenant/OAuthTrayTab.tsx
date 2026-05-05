import { useEffect, useState } from 'react'
import {
  getOAuthTrayStatus,
  completeOAuthTray,
  refreshOAuthTrayNow,
} from '../../lib/api'

interface OAuthStatus {
  connected: boolean
  expiresAt?: string
  lastRefreshAt?: string | null
  refreshFailures?: number
}

export function OAuthTrayTab({ tenantId }: { tenantId: string }) {
  const [status, setStatus] = useState<OAuthStatus | null>(null)
  const [apiAddress, setApiAddress] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [refreshToken, setRefreshToken] = useState('')
  const [expiresIn, setExpiresIn] = useState(3600)
  const [scope, setScope] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  const load = () => {
    getOAuthTrayStatus(tenantId)
      .then(setStatus)
      .catch(() => setStatus(null))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  const save = async () => {
    setMsg(null)
    try {
      await completeOAuthTray(tenantId, {
        apiAddress,
        accessToken,
        refreshToken: refreshToken || undefined,
        expiresIn,
        scope: scope || undefined,
      })
      setMsg('Salvo!')
      load()
    } catch (err: any) {
      setMsg(`Erro: ${err.message}`)
    }
  }

  const refresh = async () => {
    setMsg('Renovando…')
    try {
      const r = await refreshOAuthTrayNow(tenantId)
      setMsg(r?.refreshed ? 'Renovado!' : 'Falha ao renovar')
      load()
    } catch (err: any) {
      setMsg(`Erro: ${err.message}`)
    }
  }

  return (
    <div className="space-y-4 max-w-xl">
      <div className="border rounded p-3 bg-gray-50 text-sm">
        <h3 className="font-semibold mb-1">Status</h3>
        {status?.connected ? (
          <div className="space-y-0.5 text-gray-700">
            <div>
              Conectado: <span className="text-green-700">sim</span>
            </div>
            <div>Expira: {status.expiresAt}</div>
            <div>Última renovação: {status.lastRefreshAt || '—'}</div>
            <div>Falhas de refresh: {status.refreshFailures ?? 0}</div>
            <button
              onClick={refresh}
              className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs"
            >
              Renovar agora
            </button>
          </div>
        ) : (
          <div className="text-gray-500">Não conectado</div>
        )}
      </div>

      <div className="border-t pt-4 space-y-2">
        <h3 className="font-semibold">Conectar / Atualizar credenciais</h3>
        <div>
          <label className="block text-xs text-gray-500">API Address</label>
          <input
            value={apiAddress}
            onChange={(e) => setApiAddress(e.target.value)}
            placeholder="https://www.lojadocliente.com.br/web_api"
            className="w-full border rounded px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500">Access Token</label>
          <input
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            className="w-full border rounded px-2 py-1 text-sm"
            type="password"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500">
            Refresh Token (opcional)
          </label>
          <input
            value={refreshToken}
            onChange={(e) => setRefreshToken(e.target.value)}
            className="w-full border rounded px-2 py-1 text-sm"
            type="password"
          />
        </div>
        <div className="flex gap-2">
          <div>
            <label className="block text-xs text-gray-500">
              Expira em (segundos)
            </label>
            <input
              type="number"
              value={expiresIn}
              onChange={(e) => setExpiresIn(+e.target.value)}
              className="border rounded px-2 py-1 text-sm w-32"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500">
              Scope (opcional)
            </label>
            <input
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={save}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 rounded text-sm"
          >
            Salvar
          </button>
          {msg && <span className="text-sm self-center">{msg}</span>}
        </div>
      </div>
    </div>
  )
}
