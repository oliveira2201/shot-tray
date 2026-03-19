import { useEffect, useState } from 'react'
import { simulateFlow, fetchFlow } from '../lib/api'
import { NODE_CONFIGS } from '../lib/types'

interface Props {
  tenantId: string
  flowId: string
}

interface SimLog {
  step: number
  type: string
  label: string
  action: string
  detail?: string
  timestamp: number
  cancelled?: boolean
  realResult?: string
}

interface SimResult {
  flowId: string
  logs: SimLog[]
  currentTags: string[]
  totalTime: number
  cancelled: boolean
}

interface Preset {
  label: string
  tagsAtTime: Record<string, string[]>
}

function buildPresets(steps: any[]): Preset[] {
  // Calcular tempo acumulado e identificar cancelableWaits + mensagens após cada wait
  let time = 0
  const waits: { timeAfter: number; cancelTags: string[]; msgAfter: string | null }[] = []

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    if (step.type === 'wait') {
      time += step.seconds || 0
    } else if (step.type === 'cancelableWait') {
      time += step.seconds || 0
      // Pegar o label da próxima mensagem (sendText/sendButtons)
      const nextMsg = steps.slice(i + 1).find((s: any) => s.type === 'sendText' || s.type === 'sendButtons')
      waits.push({
        timeAfter: time,
        cancelTags: step.cancelIfTags || [],
        msgAfter: nextMsg?.label || null,
      })
    }
  }

  if (waits.length === 0) {
    return [{ label: 'Sem interrupção (flow completo)', tagsAtTime: {} }]
  }

  const presets: Preset[] = [
    { label: 'Flow completo (sem cancelamento)', tagsAtTime: {} },
  ]

  const allCancelTags = waits[0].cancelTags

  // Para cada cancelableWait: um preset que cancela DURANTE esse wait
  // (ou seja, ANTES da mensagem que vem depois)
  for (let i = 0; i < waits.length; i++) {
    const w = waits[i]
    // Cancela no meio deste wait (metade do tempo)
    const prevEnd = i > 0 ? waits[i - 1].timeAfter : 0
    const midWait = Math.floor((prevEnd + w.timeAfter) / 2)
    const cobrancasRecebidas = i // número de cobranças já enviadas antes deste wait
    const msgLabel = w.msgAfter ? ` — antes de "${w.msgAfter}"` : ''

    presets.push({
      label: `Cancela em ${formatTime(midWait)} (${cobrancasRecebidas} cobrança${cobrancasRecebidas !== 1 ? 's' : ''} enviada${cobrancasRecebidas !== 1 ? 's' : ''})${msgLabel}`,
      tagsAtTime: { [midWait.toString()]: allCancelTags },
    })
  }

  return presets
}

export function FlowSimulator({ tenantId, flowId }: Props) {
  const [result, setResult] = useState<SimResult | null>(null)
  const [running, setRunning] = useState(false)
  const [presets, setPresets] = useState<Preset[]>([{ label: 'Sem interrupção', tagsAtTime: {} }])
  const [selectedPreset, setSelectedPreset] = useState(0)
  const [customTags, setCustomTags] = useState('')
  const [customHours, setCustomHours] = useState('')
  const [customMinutes, setCustomMinutes] = useState('')
  const [phone, setPhone] = useState('5586999999999')
  const [sendReal, setSendReal] = useState(false)

  // Carregar flow e gerar presets dinâmicos
  useEffect(() => {
    fetchFlow(tenantId, flowId).then((flow) => {
      if (flow?.steps) {
        setPresets(buildPresets(flow.steps))
        setSelectedPreset(0)
      }
    }).catch(() => {})
  }, [tenantId, flowId])

  const run = async () => {
    if (sendReal && !confirm('Enviar mensagens REAIS para o número ' + phone + '?')) return

    setRunning(true)
    setResult(null)
    const preset = selectedPreset >= 0 && selectedPreset < presets.length
      ? presets[selectedPreset]
      : { tagsAtTime: {} }
    let tagsAtTime = { ...preset.tagsAtTime }

    // Adicionar tag customizada se preenchida
    if (customTags.trim() && (customHours.trim() || customMinutes.trim())) {
      const h = parseInt(customHours) || 0
      const m = parseInt(customMinutes) || 0
      const totalSeconds = h * 3600 + m * 60
      tagsAtTime = { ...tagsAtTime, [totalSeconds.toString()]: customTags.split(',').map(t => t.trim()) }
    }

    try {
      const res = await simulateFlow(tenantId, flowId, {
        context: {
          number: phone,
          name: 'Cliente Teste',
          tags: [],
          extra1: 'https://example.com/pedido/123',
          extra2: 'PIX-123456',
          extra3: 'Bíblia Sagrada NVT',
          extra4: '',
        },
        tagsAtTime,
        sendReal,
      })
      setResult(res)
    } catch (e: any) {
      setResult({ flowId, logs: [{ step: 0, type: 'error', label: 'Erro', action: e.message, timestamp: 0 }], currentTags: [], totalTime: 0, cancelled: true })
    }
    setRunning(false)
  }

  const isCustom = selectedPreset === -1

  return (
    <div className="p-4 h-full flex flex-col overflow-hidden">
      <h3 className="text-sm font-bold text-gray-700 mb-3">Simular: {flowId}</h3>

      {/* Config */}
      <div className="space-y-2 mb-4">
        <div>
          <label className="block text-[10px] text-gray-400 uppercase mb-1">Cenário</label>
          <select
            value={selectedPreset}
            onChange={(e) => setSelectedPreset(Number(e.target.value))}
            className="input-field text-sm"
          >
            {presets.map((p, i) => (
              <option key={i} value={i}>{p.label}</option>
            ))}
            <option value={-1}>Customizado</option>
          </select>
        </div>

        {isCustom && (
          <div className="space-y-2">
            <div>
              <label className="block text-[10px] text-gray-400 mb-1">Tags de cancelamento (vírgula)</label>
              <input value={customTags} onChange={(e) => setCustomTags(e.target.value)} className="input-field text-xs" placeholder="[EBE] Pedido Pago" />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[10px] text-gray-400 mb-1">Horas</label>
                <input type="number" min="0" value={customHours} onChange={(e) => setCustomHours(e.target.value)} className="input-field text-xs" placeholder="2" />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] text-gray-400 mb-1">Minutos</label>
                <input type="number" min="0" max="59" value={customMinutes} onChange={(e) => setCustomMinutes(e.target.value)} className="input-field text-xs" placeholder="30" />
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="block text-[10px] text-gray-400 uppercase mb-1">Telefone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input-field text-xs font-mono" />
        </div>

        {/* Toggle envio real */}
        <div className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 bg-gray-50">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={sendReal}
              onChange={(e) => setSendReal(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-500"></div>
          </label>
          <div className="flex-1">
            <span className={`text-xs font-medium ${sendReal ? 'text-red-600' : 'text-gray-500'}`}>
              {sendReal ? 'Enviar mensagens REAIS' : 'Apenas simulação (sem envio)'}
            </span>
            {sendReal && (
              <p className="text-[10px] text-red-400 mt-0.5">Mensagens serão enviadas de verdade!</p>
            )}
          </div>
        </div>

        <button
          onClick={run}
          disabled={running}
          className={`w-full py-2 rounded text-sm font-medium text-white transition-colors disabled:opacity-40 ${
            sendReal
              ? 'bg-red-600 hover:bg-red-500'
              : 'bg-green-600 hover:bg-green-500'
          }`}
        >
          {running ? 'Executando...' : sendReal ? 'Executar (ENVIO REAL)' : 'Executar Simulação'}
        </button>
      </div>

      {/* Resultado */}
      {result && (
        <div className="flex-1 overflow-y-auto border-t border-gray-200 pt-3">
          {/* Resumo */}
          <div className={`rounded-lg p-3 mb-3 text-sm ${result.cancelled ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
            <span className={result.cancelled ? 'text-amber-700' : 'text-green-700'}>
              {result.cancelled ? 'Flow cancelado' : 'Flow completo'} — {formatTime(result.totalTime)} total
            </span>
            {sendReal && <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded">ENVIO REAL</span>}
            <div className="text-xs text-gray-500 mt-1">
              Tags finais: {result.currentTags.join(', ') || 'nenhuma'}
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-0">
            {result.logs.map((log, i) => {
              const config = NODE_CONFIGS.find(c => c.type === log.type)
              return (
                <div key={i} className={`flex gap-2 py-1.5 px-2 rounded text-xs ${log.cancelled ? 'bg-red-50' : i % 2 === 0 ? 'bg-gray-50' : ''}`}>
                  <span className="text-gray-400 w-16 shrink-0 text-right font-mono">
                    {formatTime(log.timestamp)}
                  </span>
                  <span className="shrink-0" style={{ color: config?.color || '#6b7280' }}>
                    {config?.icon || '?'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className={`${log.cancelled ? 'text-red-600 font-medium' : 'text-gray-700'}`}>
                      {log.action}
                    </span>
                    {log.detail && (
                      <span className={`ml-1 text-[10px] ${log.detail.startsWith('ERRO') ? 'text-red-500' : log.detail.startsWith('ENVIADO') || log.detail.startsWith('TAG') ? 'text-green-600' : 'text-gray-400'}`}>
                        ({log.detail})
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function formatTime(seconds: number): string {
  if (seconds === 0) return '0s'
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return m > 0 ? `${h}h${m}m` : `${h}h`
}
