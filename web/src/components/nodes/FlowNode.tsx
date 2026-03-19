import { Handle, Position, type NodeProps } from '@xyflow/react'
import { NODE_CONFIGS, type FlowStep } from '../../lib/types'

export function FlowNode({ data, selected }: NodeProps) {
  const step = data as unknown as FlowStep & { index: number; _templateText?: string }
  const config = NODE_CONFIGS.find((c) => c.type === step.type)
  const color = config?.color ?? '#6b7280'
  const icon = config?.icon ?? ''
  const bgColor = config?.bgColor ?? color + '08'

  const detail = getDetail(step)

  return (
    <div
      className={`rounded-lg shadow-md border-2 min-w-[240px] max-w-[300px] transition-all ${
        selected ? 'ring-2 ring-blue-400 ring-offset-1' : ''
      }`}
      style={{ borderColor: color, background: '#ffffff' }}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-2.5 !h-2.5" />

      {/* Header colorido */}
      <div className="flex items-center gap-2 px-3 py-1.5" style={{ background: bgColor }}>
        <span className="text-sm">{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>
          {config?.label ?? step.type}
        </span>
      </div>

      {/* Label */}
      <div className="px-3 pt-2 pb-1">
        <p className="text-sm font-semibold text-gray-800">{step.label}</p>
      </div>

      {/* Detalhe / preview do conteúdo */}
      {detail && (
        <div className="px-3 pb-2">
          <p className="text-[11px] text-gray-500 leading-snug whitespace-pre-wrap line-clamp-3">{detail}</p>
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-2.5 !h-2.5" />
    </div>
  )
}

function getDetail(step: FlowStep & { _templateText?: string }): string {
  switch (step.type) {
    case 'sendText':
      // Mostra preview do texto real se disponível
      if (step._templateText) return step._templateText.slice(0, 120) + (step._templateText.length > 120 ? '...' : '')
      return step.textKey ? `📝 ${step.textKey}` : ''
    case 'sendButtons':
      if (step._templateText) return step._templateText.slice(0, 120) + (step._templateText.length > 120 ? '...' : '')
      return step.templateKey ? `🔘 ${step.templateKey}` : ''
    case 'wait': {
      const s = step.seconds || 0
      return `⏱ ${formatDuration(s)}`
    }
    case 'cancelableWait': {
      const s = step.seconds || 0
      const tags = (step.cancelIfTags || []).join(', ')
      return `⏳ ${formatDuration(s)}\n🛑 Cancela se: ${tags || '(nenhuma)'}`
    }
    case 'addTag':
      return `➕ ${step.tag || ''}`
    case 'removeTag':
      return `➖ ${step.tag || ''}`
    case 'stopIfHasAnyTag':
      return `🛑 ${(step.tags || []).join(', ')}`
    case 'conditionalChoice': {
      const lines: string[] = []
      if (step.conditions) {
        for (const c of step.conditions) {
          lines.push(`"${c.match}" → ${c.responseTemplate}`)
        }
      }
      if (step.defaultTemplate) {
        lines.push(`senão → ${step.defaultTemplate}`)
      }
      return lines.join('\n') || `${step.conditions?.length || 0} condições`
    }
    case 'scheduleFlow':
      return `📅 ${step.flowId} +${formatDuration(step.delaySeconds || 0)}`
    default:
      return ''
  }
}

function formatDuration(s: number): string {
  if (s === 0) return '0s'
  const parts: string[] = []
  const d = Math.floor(s / 86400); if (d) parts.push(`${d}d`)
  const h = Math.floor((s % 86400) / 3600); if (h) parts.push(`${h}h`)
  const m = Math.floor((s % 3600) / 60); if (m) parts.push(`${m}min`)
  const sec = s % 60; if (sec) parts.push(`${sec}s`)
  return parts.join(' ')
}
