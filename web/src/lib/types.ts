export type StepType =
  | 'sendText'
  | 'sendButtons'
  | 'wait'
  | 'cancelableWait'
  | 'addTag'
  | 'removeTag'
  | 'stopIfHasAnyTag'
  | 'conditionalChoice'
  | 'scheduleFlow'

export interface FlowStep {
  type: StepType
  label: string
  // sendText
  textKey?: string
  // sendButtons
  templateKey?: string
  // wait
  seconds?: number
  // addTag / removeTag
  tag?: string
  // stopIfHasAnyTag
  tags?: string[]
  // conditionalChoice
  conditions?: { match: string; responseTemplate: string }[]
  defaultTemplate?: string
  // scheduleFlow
  flowId?: string
  delaySeconds?: number
  // cancelableWait
  cancelIfTags?: string[]
}

export interface FlowDefinition {
  id: string
  title: string
  aliases?: string[]
  description?: string
  steps: FlowStep[]
}

export interface NodeConfig {
  type: StepType
  label: string
  color: string
  bgColor: string
  icon: string
  defaults: Partial<FlowStep>
}

export const NODE_CONFIGS: NodeConfig[] = [
  { type: 'sendText', label: 'Enviar Texto', color: '#2563eb', bgColor: '#dbeafe', icon: '💬', defaults: { textKey: '' } },
  { type: 'sendButtons', label: 'Enviar Botões', color: '#7c3aed', bgColor: '#ede9fe', icon: '🔘', defaults: { templateKey: '' } },
  { type: 'wait', label: 'Aguardar', color: '#6b7280', bgColor: '#f3f4f6', icon: '⏱️', defaults: { seconds: 60 } },
  { type: 'cancelableWait', label: 'Aguardar (cancelável)', color: '#0d9488', bgColor: '#ccfbf1', icon: '⏳', defaults: { seconds: 3600, cancelIfTags: [] } },
  { type: 'addTag', label: 'Adicionar Tag', color: '#ea580c', bgColor: '#fff7ed', icon: '🏷️', defaults: { tag: '' } },
  { type: 'removeTag', label: 'Remover Tag', color: '#dc2626', bgColor: '#fef2f2', icon: '🗑️', defaults: { tag: '' } },
  { type: 'stopIfHasAnyTag', label: 'Parar se Tag', color: '#be185d', bgColor: '#fdf2f8', icon: '🛑', defaults: { tags: [] } },
  { type: 'conditionalChoice', label: 'Condição', color: '#7c3aed', bgColor: '#f5f3ff', icon: '🔀', defaults: { conditions: [], defaultTemplate: '' } },
  { type: 'scheduleFlow', label: 'Agendar Flow', color: '#ca8a04', bgColor: '#fefce8', icon: '📅', defaults: { flowId: '', delaySeconds: 0 } },
]
