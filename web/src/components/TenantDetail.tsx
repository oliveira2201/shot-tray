import { useState } from 'react'
import { ConfigTab } from './tenant/ConfigTab'
import { TemplatesTab } from './tenant/TemplatesTab'
import { FlowsTab } from './tenant/FlowsTab'
import { OAuthTrayTab } from './tenant/OAuthTrayTab'

type TabId = 'config' | 'templates' | 'flows' | 'oauth'

export function TenantDetail({
  tenantId,
  onBack,
}: {
  tenantId: string
  onBack: () => void
}) {
  const [tab, setTab] = useState<TabId>('config')
  const [adapterType, setAdapterType] = useState<string | null>(null)

  const tabs: [TabId, string][] = [
    ['config', 'Config'],
    ['templates', 'Templates'],
    ['flows', 'Flows'],
    ...((adapterType === 'tray' ? [['oauth', 'OAuth Tray']] : []) as [TabId, string][]),
  ]

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="text-gray-500 hover:text-gray-800 text-sm"
        >
          ← Voltar
        </button>
        <h2 className="text-2xl font-bold font-mono">{tenantId}</h2>
      </div>
      <nav className="flex gap-1 mb-4 border-b">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm border-b-2 ${
              tab === k
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === 'config' && (
        <ConfigTab tenantId={tenantId} onAdapterTypeChange={setAdapterType} />
      )}
      {tab === 'templates' && <TemplatesTab tenantId={tenantId} />}
      {tab === 'flows' && <FlowsTab tenantId={tenantId} />}
      {tab === 'oauth' && adapterType === 'tray' && (
        <OAuthTrayTab tenantId={tenantId} />
      )}
    </div>
  )
}
