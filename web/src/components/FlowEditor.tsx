import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { FlowNode } from './nodes/FlowNode'
import { NodePalette } from './NodePalette'
import { PropertiesPanel } from './PropertiesPanel'
import { flowToReactFlow, reactFlowToSteps } from '../lib/converter'
import { NODE_CONFIGS, type FlowDefinition } from '../lib/types'
import { saveFlow, fetchTemplates } from '../lib/api'

const nodeTypes = { flowNode: FlowNode }

interface Props {
  tenantId: string
  flow: FlowDefinition
  onSaved: () => void
}

function FlowEditorInner({ tenantId, flow, onSaved }: Props) {
  const { nodes: initialNodes, edges: initialEdges } = flowToReactFlow(flow)
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // Carregar templates e enriquecer nodos com texto real
  useEffect(() => {
    fetchTemplates(tenantId).then((tpl) => {
      if (!tpl || tpl.error) return
      setNodes((nds) =>
        nds.map((n) => {
          const d = n.data as any
          let templateText = ''
          if (d.type === 'sendText' && d.textKey && tpl.text?.[d.textKey]) {
            templateText = tpl.text[d.textKey]
          } else if (d.type === 'sendButtons' && d.templateKey && tpl.buttons?.[d.templateKey]) {
            templateText = tpl.buttons[d.templateKey].body || tpl.buttons[d.templateKey].title || ''
          }
          if (templateText) return { ...n, data: { ...d, _templateText: templateText } }
          return n
        })
      )
    }).catch(() => {})
  }, [tenantId, setNodes])
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const idCounter = useRef(flow.steps.length)

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, type: 'smoothstep', animated: true, style: { stroke: '#94a3b8' } }, eds))
      setDirty(true)
    },
    [setEdges],
  )

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [])

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const type = event.dataTransfer.getData('application/shotflow-type')
      if (!type) return

      const config = NODE_CONFIGS.find((c) => c.type === type)
      if (!config) return

      const bounds = reactFlowWrapper.current?.getBoundingClientRect()
      if (!bounds) return

      const position = {
        x: event.clientX - bounds.left - 110,
        y: event.clientY - bounds.top - 30,
      }

      const newId = `step-${idCounter.current++}`
      const newNode: Node = {
        id: newId,
        type: 'flowNode',
        position,
        data: {
          type: config.type,
          label: config.label,
          index: idCounter.current,
          ...config.defaults,
        },
      }

      setNodes((nds) => [...nds, newNode])

      // Auto-connect ao último nodo
      setEdges((eds) => {
        if (eds.length === 0 && nodes.length === 0) return eds
        const lastNodeId = nodes.length > 0 ? nodes[nodes.length - 1].id : null
        if (!lastNodeId) return eds
        return [
          ...eds,
          {
            id: `e-${lastNodeId}-${newId}`,
            source: lastNodeId,
            target: newId,
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#94a3b8' },
          } as Edge,
        ]
      })

      setDirty(true)
    },
    [nodes, setNodes, setEdges],
  )

  const onUpdateNode = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      setNodes((nds) => nds.map((n) => (n.id === nodeId ? { ...n, data } : n)))
      setSelectedNode((prev) => (prev?.id === nodeId ? { ...prev, data } : prev))
      setDirty(true)
    },
    [setNodes],
  )

  const onDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId))
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
      setSelectedNode(null)
      setDirty(true)
    },
    [setNodes, setEdges],
  )

  const handleSave = async () => {
    setSaving(true)
    const steps = reactFlowToSteps(nodes)
    const updated: FlowDefinition = { ...flow, steps }
    await saveFlow(tenantId, flow.id, updated)
    setSaving(false)
    setDirty(false)
    onSaved()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="h-11 bg-white border-b border-gray-200 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-800">{flow.title}</span>
          <span className="text-xs text-gray-400">{tenantId}/{flow.id}</span>
          {dirty && <span className="text-xs text-amber-500 font-medium">* modificado</span>}
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="px-4 py-1.5 rounded text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 relative" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#e2e8f0" gap={20} />
            <Controls className="!bg-white !border-gray-200 !shadow [&>button]:!bg-white [&>button]:!border-gray-200 [&>button]:!text-gray-600 [&>button:hover]:!bg-gray-50" />
          </ReactFlow>

          {/* Paleta de nodos no topo do canvas */}
          <NodePalette />
        </div>

        {/* Properties panel */}
        <PropertiesPanel tenantId={tenantId} node={selectedNode} onUpdate={onUpdateNode} onDelete={onDeleteNode} />
      </div>
    </div>
  )
}

export function FlowEditor(props: Props) {
  return (
    <ReactFlowProvider>
      <FlowEditorInner {...props} />
    </ReactFlowProvider>
  )
}
