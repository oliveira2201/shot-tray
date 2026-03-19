import { useEffect, useState } from 'react'
import type { Node } from '@xyflow/react'
import { NODE_CONFIGS, type FlowStep } from '../lib/types'
import { fetchTemplates, saveTemplate } from '../lib/api'

interface Props {
  tenantId: string
  node: Node | null
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void
  onDelete: (nodeId: string) => void
}

export function PropertiesPanel({ tenantId, node, onUpdate, onDelete }: Props) {
  const [templates, setTemplates] = useState<{ text: Record<string, string>; buttons: Record<string, any> } | null>(null)
  const [savingTemplate, setSavingTemplate] = useState(false)

  useEffect(() => {
    if (tenantId) fetchTemplates(tenantId).then(setTemplates)
  }, [tenantId])

  if (!node) {
    return (
      <div className="w-80 bg-gray-50 border-l border-gray-200 p-4 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Selecione um nodo para editar</p>
      </div>
    )
  }

  const step = node.data as unknown as FlowStep & { index: number }
  const config = NODE_CONFIGS.find((c) => c.type === step.type)

  const update = (field: string, value: unknown) => {
    onUpdate(node.id, { ...node.data, [field]: value })
  }

  const handleSaveText = async (key: string, value: string) => {
    setSavingTemplate(true)
    await saveTemplate(tenantId, 'text', key, value)
    setTemplates((prev) => prev ? { ...prev, text: { ...prev.text, [key]: value } } : prev)
    setSavingTemplate(false)
  }

  const handleSaveButtonTemplate = async (key: string, updated: any) => {
    setSavingTemplate(true)
    await saveTemplate(tenantId, 'buttons', key, updated)
    setTemplates((prev) => prev ? { ...prev, buttons: { ...prev.buttons, [key]: updated } } : prev)
    setSavingTemplate(false)
  }

  return (
    <div className="w-80 bg-gray-50 border-l border-gray-200 p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span>{config?.icon}</span>
          <h3 className="font-bold text-sm" style={{ color: config?.color }}>
            {config?.label}
          </h3>
        </div>
        <button
          onClick={() => onDelete(node.id)}
          className="text-red-500 hover:text-red-600 text-xs px-2 py-1 rounded bg-red-50 hover:bg-red-100"
        >
          Excluir
        </button>
      </div>

      <Field label="Label">
        <input value={step.label || ''} onChange={(e) => update('label', e.target.value)} className="input-field" />
      </Field>

      {/* sendText — mostra texto real */}
      {step.type === 'sendText' && (
        <>
          <Field label="Text Key">
            <input value={step.textKey || ''} onChange={(e) => update('textKey', e.target.value)} className="input-field text-xs font-mono" />
          </Field>
          {step.textKey && templates?.text?.[step.textKey] !== undefined && (
            <Field label="Mensagem">
              <EditableTextarea
                value={templates.text[step.textKey]}
                onSave={(v) => handleSaveText(step.textKey!, v)}
                saving={savingTemplate}
              />
            </Field>
          )}
        </>
      )}

      {/* sendButtons — mostra template real */}
      {step.type === 'sendButtons' && (
        <>
          <Field label="Template Key">
            <input value={step.templateKey || ''} onChange={(e) => update('templateKey', e.target.value)} className="input-field text-xs font-mono" />
          </Field>
          {step.templateKey && templates?.buttons?.[step.templateKey] && (
            <ButtonTemplateEditor
              template={templates.buttons[step.templateKey]}
              onSave={(updated) => handleSaveButtonTemplate(step.templateKey!, updated)}
              saving={savingTemplate}
            />
          )}
        </>
      )}

      {step.type === 'wait' && (
        <Field label="Tempo de espera">
          <DurationPicker seconds={step.seconds || 0} onChange={(s) => update('seconds', s)} />
        </Field>
      )}

      {step.type === 'cancelableWait' && (
        <>
          <Field label="Tempo de espera">
            <DurationPicker seconds={step.seconds || 0} onChange={(s) => update('seconds', s)} />
          </Field>
          <Field label="Cancelar se tiver tags (uma por linha)">
            <textarea
              value={(step.cancelIfTags || []).join('\n')}
              onChange={(e) => update('cancelIfTags', e.target.value.split('\n').filter(Boolean))}
              className="input-field h-20 resize-none"
            />
          </Field>
        </>
      )}

      {(step.type === 'addTag' || step.type === 'removeTag') && (
        <Field label="Tag">
          <input value={step.tag || ''} onChange={(e) => update('tag', e.target.value)} className="input-field" />
        </Field>
      )}

      {step.type === 'stopIfHasAnyTag' && (
        <Field label="Tags (uma por linha)">
          <textarea
            value={(step.tags || []).join('\n')}
            onChange={(e) => update('tags', e.target.value.split('\n').filter(Boolean))}
            className="input-field h-24 resize-none"
          />
        </Field>
      )}

      {step.type === 'conditionalChoice' && (
        <>
          <Field label="Se nenhuma condição bater, envia:">
            <input value={step.defaultTemplate || ''} onChange={(e) => update('defaultTemplate', e.target.value)} className="input-field" placeholder="Template padrão" />
          </Field>
          <Field label="Quando o cliente responder:">
            <ConditionsEditor conditions={step.conditions || []} onChange={(c) => update('conditions', c)} />
          </Field>
        </>
      )}

      {step.type === 'scheduleFlow' && (
        <>
          <Field label="Flow ID">
            <input value={step.flowId || ''} onChange={(e) => update('flowId', e.target.value)} className="input-field" />
          </Field>
          <Field label="Delay (segundos)">
            <input type="number" value={step.delaySeconds || 0} onChange={(e) => update('delaySeconds', parseInt(e.target.value) || 0)} className="input-field" />
          </Field>
        </>
      )}
    </div>
  )
}

/** Textarea editável com botão Salvar */
function EditableTextarea({ value, onSave, saving }: { value: string; onSave: (v: string) => void; saving: boolean }) {
  const [text, setText] = useState(value)
  const [dirty, setDirty] = useState(false)

  useEffect(() => { setText(value); setDirty(false) }, [value])

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setDirty(true) }}
        className="input-field h-36 resize-y text-xs leading-relaxed"
      />
      {dirty && (
        <button
          onClick={() => { onSave(text); setDirty(false) }}
          disabled={saving}
          className="mt-1 w-full py-1 rounded text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40"
        >
          {saving ? 'Salvando...' : 'Salvar Texto'}
        </button>
      )}
    </div>
  )
}

/** Editor de template de botões */
function ButtonTemplateEditor({ template, onSave, saving }: { template: any; onSave: (updated: any) => void; saving: boolean }) {
  const [title, setTitle] = useState(template.title || '')
  const [body, setBody] = useState(template.body || '')
  const [footer, setFooter] = useState(template.footer || '')
  const [buttons, setButtons] = useState<any[]>(template.buttons || [])
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setTitle(template.title || '')
    setBody(template.body || '')
    setFooter(template.footer || '')
    setButtons(template.buttons || [])
    setDirty(false)
  }, [template])

  const markDirty = () => setDirty(true)

  const handleSave = () => {
    onSave({ ...template, title, body, footer, buttons })
    setDirty(false)
  }

  const updateButton = (i: number, field: string, value: string) => {
    const next = [...buttons]
    next[i] = { ...next[i], [field]: value }
    setButtons(next)
    markDirty()
  }

  return (
    <div className="space-y-2 mt-2">
      <Field label="Título">
        <input value={title} onChange={(e) => { setTitle(e.target.value); markDirty() }} className="input-field text-xs" />
      </Field>
      <Field label="Corpo">
        <textarea value={body} onChange={(e) => { setBody(e.target.value); markDirty() }} className="input-field h-32 resize-y text-xs leading-relaxed" />
      </Field>
      {template.footer !== undefined && (
        <Field label="Rodapé">
          <input value={footer} onChange={(e) => { setFooter(e.target.value); markDirty() }} className="input-field text-xs" />
        </Field>
      )}
      <Field label="Botoes">
        <div className="space-y-1.5">
          {buttons.map((btn: any, i: number) => (
            <div key={i} className="bg-white rounded border border-gray-200 p-2 space-y-1">
              <div className="flex items-center gap-1">
                <select value={btn.type || 'url'} onChange={(e) => updateButton(i, 'type', e.target.value)} className="input-field text-[10px] w-28">
                  <option value="url">URL</option>
                  <option value="quick_reply">Quick Reply</option>
                  <option value="quickreply">Quick Reply (legacy)</option>
                  <option value="call">Ligar</option>
                  <option value="copy">Copiar</option>
                  <option value="pix">PIX</option>
                </select>
                <input value={btn.text || ''} onChange={(e) => updateButton(i, 'text', e.target.value)} className="input-field text-xs flex-1" placeholder="Texto do botao" />
                <button onClick={() => { const next = buttons.filter((_: any, idx: number) => idx !== i); setButtons(next); markDirty() }} className="text-red-400 hover:text-red-500 text-sm px-1" title="Remover">x</button>
              </div>
              {btn.type === 'url' && (
                <input value={btn.url || ''} onChange={(e) => updateButton(i, 'url', e.target.value)} className="input-field text-xs font-mono" placeholder="https://... ou {{extra1}}" />
              )}
              {(btn.type === 'quickreply' || btn.type === 'quick_reply') && (
                <input value={btn.value || btn.id || ''} onChange={(e) => updateButton(i, 'value', e.target.value)} className="input-field text-xs" placeholder="Valor enviado quando clicado" />
              )}
              {btn.type === 'call' && (
                <input value={btn.phoneNumber || ''} onChange={(e) => updateButton(i, 'phoneNumber', e.target.value)} className="input-field text-xs font-mono" placeholder="5511999999999" />
              )}
              {btn.type === 'copy' && (
                <input value={btn.code || ''} onChange={(e) => updateButton(i, 'code', e.target.value)} className="input-field text-xs font-mono" placeholder="Codigo para copiar" />
              )}
              {btn.type === 'pix' && (
                <>
                  <input value={btn.pixKey || ''} onChange={(e) => updateButton(i, 'pixKey', e.target.value)} className="input-field text-xs font-mono" placeholder="Chave PIX" />
                  <select value={btn.pixType || 'email'} onChange={(e) => updateButton(i, 'pixType', e.target.value)} className="input-field text-[10px]">
                    <option value="email">Email</option>
                    <option value="cpf">CPF</option>
                    <option value="cnpj">CNPJ</option>
                    <option value="phone">Telefone</option>
                    <option value="random">Aleatoria</option>
                  </select>
                </>
              )}
            </div>
          ))}
          <button
            onClick={() => { setButtons([...buttons, { type: 'url', text: '', url: '' }]); markDirty() }}
            className="text-xs text-blue-500 hover:text-blue-600"
          >
            + Adicionar botao
          </button>
        </div>
      </Field>
      {dirty && <SaveBtn onClick={handleSave} saving={saving} />}
    </div>
  )
}

function DurationPicker({ seconds, onChange }: { seconds: number; onChange: (s: number) => void }) {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  const set = (d: number, h: number, m: number, s: number) => {
    onChange(d * 86400 + h * 3600 + m * 60 + s)
  }

  return (
    <div>
      <div className="grid grid-cols-4 gap-1.5">
        <div>
          <label className="block text-[10px] text-gray-400 text-center">Dias</label>
          <input type="number" min={0} value={days} onChange={(e) => set(parseInt(e.target.value) || 0, hours, minutes, secs)} className="input-field text-center text-sm" />
        </div>
        <div>
          <label className="block text-[10px] text-gray-400 text-center">Horas</label>
          <input type="number" min={0} max={23} value={hours} onChange={(e) => set(days, parseInt(e.target.value) || 0, minutes, secs)} className="input-field text-center text-sm" />
        </div>
        <div>
          <label className="block text-[10px] text-gray-400 text-center">Min</label>
          <input type="number" min={0} max={59} value={minutes} onChange={(e) => set(days, hours, parseInt(e.target.value) || 0, secs)} className="input-field text-center text-sm" />
        </div>
        <div>
          <label className="block text-[10px] text-gray-400 text-center">Seg</label>
          <input type="number" min={0} max={59} value={secs} onChange={(e) => set(days, hours, minutes, parseInt(e.target.value) || 0)} className="input-field text-center text-sm" />
        </div>
      </div>
      <p className="text-[10px] text-gray-400 text-center mt-1">= {formatDuration(seconds)}</p>
    </div>
  )
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

function SaveBtn({ onClick, saving }: { onClick: () => void; saving: boolean }) {
  return (
    <button onClick={onClick} disabled={saving} className="mt-1 w-full py-1 rounded text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40">
      {saving ? 'Salvando...' : 'Salvar'}
    </button>
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

function ConditionsEditor({ conditions, onChange }: { conditions: { match: string; responseTemplate: string }[]; onChange: (c: { match: string; responseTemplate: string }[]) => void }) {
  const update = (i: number, field: string, value: string) => { const next = [...conditions]; next[i] = { ...next[i], [field]: value }; onChange(next) }
  const add = () => onChange([...conditions, { match: '', responseTemplate: '' }])
  const remove = (i: number) => onChange(conditions.filter((_, idx) => idx !== i))

  return (
    <div className="space-y-2">
      {conditions.map((c, i) => (
        <div key={i} className="bg-white rounded border border-gray-200 p-2 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-400">#{i + 1}</span>
            <button onClick={() => remove(i)} className="text-red-400 text-[10px] hover:text-red-500">remover</button>
          </div>
          <label className="text-[10px] text-gray-400">Se a resposta contém:</label>
          <input placeholder="ex: rastrear" value={c.match} onChange={(e) => update(i, 'match', e.target.value)} className="input-field text-xs" />
          <label className="text-[10px] text-gray-400">Enviar template:</label>
          <input placeholder="ex: pedidoRecebidoRastrear" value={c.responseTemplate} onChange={(e) => update(i, 'responseTemplate', e.target.value)} className="input-field text-xs" />
        </div>
      ))}
      <button onClick={add} className="text-xs text-blue-500 hover:text-blue-600">+ Adicionar condição</button>
    </div>
  )
}
