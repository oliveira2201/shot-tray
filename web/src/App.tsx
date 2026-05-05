import { useEffect, useState } from 'react'
import { FlowEditor } from './components/FlowEditor'
import { FlowSimulator } from './components/FlowSimulator'
import { SettingsPanel } from './components/SettingsPanel'
import { Dashboard } from './components/Dashboard'
import { Monitor } from './components/Monitor'
import { History } from './components/History'
import { TenantList } from './components/TenantList'
import { TenantDetail } from './components/TenantDetail'
import { fetchTenants, fetchFlows, fetchFlow } from './lib/api'
import type { FlowDefinition } from './lib/types'

type Tab = 'editor' | 'simulate' | 'settings' | 'monitor' | 'history'
type Mode = 'app' | 'tenants'

export default function App() {
  const [tenants, setTenants] = useState<string[]>([])
  const [flows, setFlows] = useState<string[]>([])
  const [selectedTenant, setSelectedTenant] = useState('')
  const [selectedFlow, setSelectedFlow] = useState<FlowDefinition | null>(null)
  const [activeFlowId, setActiveFlowId] = useState('')
  const [tab, setTab] = useState<Tab>('editor')
  const [mode, setMode] = useState<Mode>('app')
  const [selectedAdminTenant, setSelectedAdminTenant] = useState<string | null>(null)

  useEffect(() => {
    fetchTenants().then((list) => {
      setTenants(list)
      if (list.length > 0) selectTenant(list[0])
    })
  }, [])

  const selectTenant = async (tenantId: string) => {
    setSelectedTenant(tenantId)
    const list = await fetchFlows(tenantId)
    setFlows(list)
    setSelectedFlow(null)
    setActiveFlowId('')
  }

  const selectFlow = async (flowId: string) => {
    const flow = await fetchFlow(selectedTenant, flowId)
    setSelectedFlow(flow)
    setActiveFlowId(flowId)
    setTab('editor')
  }

  return (
    <div className="flex h-screen bg-white text-gray-800">
      {/* Sidebar */}
      <div className="w-56 bg-gray-50 border-r border-gray-200 flex flex-col overflow-hidden">
        {/* Tenant */}
        <div className="px-3 py-3 border-b border-gray-200">
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Tenant</label>
          <select
            value={selectedTenant}
            onChange={(e) => selectTenant(e.target.value)}
            className="w-full text-sm px-2 py-1.5 rounded border border-gray-300 bg-white focus:outline-none focus:border-blue-500"
          >
            {tenants.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Dashboard link */}
        <div className="px-3 pt-2">
          <button
            onClick={() => { setMode('app'); setSelectedFlow(null); setActiveFlowId(''); setTab('editor') }}
            className={`w-full text-left px-2.5 py-2 rounded text-sm flex items-center gap-2 transition-colors ${
              mode === 'app' && !activeFlowId && tab !== 'settings'
                ? 'bg-blue-100 text-blue-700 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span>&#9776;</span> Pipeline
          </button>
        </div>

        {/* Flows */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-3 py-2">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Flows</h3>
            <div className="space-y-0.5">
              {flows.map((f) => (
                <button
                  key={f}
                  onClick={() => selectFlow(f)}
                  className={`w-full text-left px-2.5 py-1.5 rounded text-sm transition-colors ${
                    activeFlowId === f
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom links */}
        <div className="border-t border-gray-200 p-2 space-y-0.5">
          <button
            onClick={() => { setMode('tenants'); setSelectedAdminTenant(null) }}
            className={`w-full text-left px-2.5 py-2 rounded text-sm flex items-center gap-2 transition-colors ${
              mode === 'tenants' ? 'bg-indigo-100 text-indigo-700 font-medium' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <span>&#128100;</span> Tenants Admin
          </button>
          <button
            onClick={() => { setMode('app'); setSelectedFlow(null); setActiveFlowId(''); setTab('monitor') }}
            className={`w-full text-left px-2.5 py-2 rounded text-sm flex items-center gap-2 transition-colors ${
              mode === 'app' && tab === 'monitor' ? 'bg-green-100 text-green-700 font-medium' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <span>&#9889;</span> Monitor
          </button>
          <button
            onClick={() => { setMode('app'); setSelectedFlow(null); setActiveFlowId(''); setTab('history') }}
            className={`w-full text-left px-2.5 py-2 rounded text-sm flex items-center gap-2 transition-colors ${
              mode === 'app' && tab === 'history' ? 'bg-purple-100 text-purple-700 font-medium' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <span>&#128338;</span> Histórico
          </button>
          <button
            onClick={() => { setMode('app'); setTab('settings') }}
            className={`w-full text-left px-2.5 py-2 rounded text-sm flex items-center gap-2 transition-colors ${
              mode === 'app' && tab === 'settings' ? 'bg-gray-200 text-gray-800 font-medium' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <span>&#9881;</span> Configurações
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tab bar (somente no modo app, com flow ativo) */}
        {mode === 'app' && activeFlowId && tab !== 'settings' && (
          <div className="h-9 bg-gray-50 border-b border-gray-200 flex items-center px-4 gap-1">
            <TabBtn active={tab === 'editor'} onClick={() => setTab('editor')}>Editor</TabBtn>
            <TabBtn active={tab === 'simulate'} onClick={() => setTab('simulate')}>Simular</TabBtn>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {mode === 'tenants' && !selectedAdminTenant && (
            <div className="h-full overflow-y-auto">
              <TenantList
                onSelect={(id) => setSelectedAdminTenant(id)}
                onNew={() => {
                  const id = prompt('ID do novo tenant (a-z0-9_-):')
                  if (id && /^[a-z0-9_-]+$/.test(id)) setSelectedAdminTenant(id)
                  else if (id) alert('ID inválido. Use a-z, 0-9, _ ou -')
                }}
              />
            </div>
          )}

          {mode === 'tenants' && selectedAdminTenant && (
            <TenantDetail
              tenantId={selectedAdminTenant}
              onBack={() => setSelectedAdminTenant(null)}
            />
          )}

          {mode === 'app' && tab === 'monitor' && <Monitor />}

          {mode === 'app' && tab === 'history' && selectedTenant && (
            <History tenantId={selectedTenant} />
          )}

          {mode === 'app' && tab === 'settings' && selectedTenant && (
            <div className="h-full overflow-y-auto">
              <SettingsPanel tenantId={selectedTenant} />
            </div>
          )}

          {mode === 'app' && tab === 'editor' && selectedFlow && (
            <FlowEditor key={activeFlowId} tenantId={selectedTenant} flow={selectedFlow} onSaved={() => {}} />
          )}

          {mode === 'app' && tab === 'simulate' && activeFlowId && (
            <FlowSimulator tenantId={selectedTenant} flowId={activeFlowId} />
          )}

          {/* Dashboard quando nenhum flow selecionado e sem outra tab ativa */}
          {mode === 'app' && !selectedFlow && tab !== 'settings' && tab !== 'monitor' && tab !== 'history' && selectedTenant && (
            <Dashboard tenantId={selectedTenant} onOpenFlow={selectFlow} onOpenSettings={() => setTab('settings')} />
          )}
        </div>
      </div>
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
        active ? 'bg-white text-blue-600 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  )
}
