import { useEffect, useState } from 'react'
import {
  listAdminTemplates,
  saveAdminTemplate,
  deleteAdminTemplate,
} from '../../lib/api'

interface Template {
  kind: string
  key: string
  content: any
}

export function TemplatesTab({ tenantId }: { tenantId: string }) {
  const [list, setList] = useState<Template[]>([])
  const [editing, setEditing] = useState<Template | null>(null)
  const [editContent, setEditContent] = useState('')
  const [newKind, setNewKind] = useState('text')
  const [newKey, setNewKey] = useState('')

  const load = () => {
    listAdminTemplates(tenantId).then((r) =>
      setList(Array.isArray(r) ? r : [])
    )
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  const startEdit = (t: Template) => {
    setEditing(t)
    setEditContent(
      typeof t.content === 'string'
        ? t.content
        : JSON.stringify(t.content, null, 2)
    )
  }

  const save = async () => {
    if (!editing) return
    let parsed: any = editContent
    if (editing.kind === 'buttons') {
      try {
        parsed = JSON.parse(editContent)
      } catch {
        alert('JSON inválido')
        return
      }
    }
    try {
      await saveAdminTemplate(tenantId, {
        kind: editing.kind,
        key: editing.key,
        content: parsed,
      })
      setEditing(null)
      load()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const create = async () => {
    if (!newKey) return
    const content: any =
      newKind === 'buttons' ? { title: '', body: '', buttons: [] } : ''
    try {
      await saveAdminTemplate(tenantId, { kind: newKind, key: newKey, content })
      setNewKey('')
      load()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const remove = async (t: Template) => {
    if (!confirm(`Deletar template ${t.kind}/${t.key}?`)) return
    try {
      await deleteAdminTemplate(tenantId, t.kind, t.key)
      load()
    } catch (err: any) {
      alert(err.message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2 border-b pb-3">
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Tipo</label>
          <select
            value={newKind}
            onChange={(e) => setNewKind(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="text">text</option>
            <option value="buttons">buttons</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-0.5">Key</label>
          <input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="ex: pedidoRecebido"
            className="w-full border rounded px-2 py-1 text-sm"
          />
        </div>
        <button
          onClick={create}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
        >
          + Novo
        </button>
      </div>
      <div className="space-y-1">
        {list.map((t) => (
          <div
            key={`${t.kind}-${t.key}`}
            className="flex items-center gap-2 hover:bg-gray-50 p-2 border-b"
          >
            <span className="text-xs text-gray-500 w-20">{t.kind}</span>
            <span className="font-mono text-sm flex-1">{t.key}</span>
            <button
              onClick={() => startEdit(t)}
              className="text-blue-600 text-sm hover:underline"
            >
              editar
            </button>
            <button
              onClick={() => remove(t)}
              className="text-red-500 text-sm"
              title="Deletar"
            >
              ×
            </button>
          </div>
        ))}
        {list.length === 0 && (
          <div className="text-center text-gray-400 py-6 text-sm">
            Nenhum template
          </div>
        )}
      </div>
      {editing && (
        <div className="border-t pt-4 space-y-2">
          <h3 className="font-semibold">
            Editar:{' '}
            <span className="text-xs text-gray-500">{editing.kind}</span>{' '}
            {editing.key}
          </h3>
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full font-mono text-sm border rounded p-2"
            rows={12}
          />
          <div className="flex gap-2">
            <button
              onClick={save}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 rounded text-sm"
            >
              Salvar
            </button>
            <button
              onClick={() => setEditing(null)}
              className="text-gray-500 text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
