import { useEffect, useState } from 'react'
import {
  listAdminFlows,
  getAdminFlow,
  saveAdminFlow,
  deleteAdminFlow,
} from '../../lib/api'

interface Flow {
  slug: string
  title: string
  aliases?: string[]
  description?: string
  steps?: any[]
  enabled?: boolean
}

export function FlowsTab({ tenantId }: { tenantId: string }) {
  const [list, setList] = useState<Flow[]>([])
  const [editing, setEditing] = useState<Flow | null>(null)
  const [editJson, setEditJson] = useState('')

  const load = () => {
    listAdminFlows(tenantId).then((r) => setList(Array.isArray(r) ? r : []))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  const startEdit = async (slug: string) => {
    try {
      const f = await getAdminFlow(tenantId, slug)
      setEditing(f)
      setEditJson(JSON.stringify(f, null, 2))
    } catch (err: any) {
      alert(err.message)
    }
  }

  const save = async () => {
    try {
      const parsed = JSON.parse(editJson)
      await saveAdminFlow(tenantId, parsed)
      setEditing(null)
      load()
    } catch (err: any) {
      alert(`Falha: ${err.message}`)
    }
  }

  const remove = async (slug: string) => {
    if (!confirm(`Deletar flow ${slug}?`)) return
    try {
      await deleteAdminFlow(tenantId, slug)
      load()
    } catch (err: any) {
      alert(err.message)
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        {list.map((f) => (
          <div
            key={f.slug}
            className="flex items-center gap-2 hover:bg-gray-50 p-2 border-b"
          >
            <span className="font-mono text-sm flex-1">{f.slug}</span>
            <span className="text-xs text-gray-500 truncate w-1/3">
              {f.title}
            </span>
            <button
              onClick={() => startEdit(f.slug)}
              className="text-blue-600 text-sm hover:underline"
            >
              editar
            </button>
            <button
              onClick={() => remove(f.slug)}
              className="text-red-500 text-sm"
              title="Deletar"
            >
              ×
            </button>
          </div>
        ))}
        {list.length === 0 && (
          <div className="text-center text-gray-400 py-6 text-sm">
            Nenhum flow
          </div>
        )}
      </div>
      {editing && (
        <div className="border-t pt-4 space-y-2">
          <h3 className="font-semibold">
            Editar flow: <span className="font-mono">{editing.slug}</span>
          </h3>
          <textarea
            value={editJson}
            onChange={(e) => setEditJson(e.target.value)}
            className="w-full font-mono text-xs border rounded p-2"
            rows={20}
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
