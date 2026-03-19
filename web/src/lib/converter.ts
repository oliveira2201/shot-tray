import type { Node, Edge } from '@xyflow/react'
import type { FlowStep, FlowDefinition } from './types'

const NODE_Y_GAP = 200
const NODE_X = 300

/** Converte FlowDefinition JSON → nodes + edges do React Flow */
export function flowToReactFlow(flow: FlowDefinition): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []

  flow.steps.forEach((step, i) => {
    const nodeId = `step-${i}`
    nodes.push({
      id: nodeId,
      type: 'flowNode',
      position: { x: NODE_X, y: i * NODE_Y_GAP },
      data: { ...step, index: i },
    })

    if (i > 0) {
      edges.push({
        id: `e-${i - 1}-${i}`,
        source: `step-${i - 1}`,
        target: nodeId,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#64748b' },
      })
    }
  })

  return { nodes, edges }
}

/** Converte nodes do React Flow → array de steps para o JSON */
export function reactFlowToSteps(nodes: Node[]): FlowStep[] {
  // Ordenar por posição Y (ordem visual)
  const sorted = [...nodes].sort((a, b) => a.position.y - b.position.y)

  return sorted.map((node) => {
    const { index, ...stepData } = node.data as unknown as FlowStep & { index: number }
    // Limpar campos undefined
    const step: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(stepData)) {
      if (value !== undefined && value !== '') {
        step[key] = value
      }
    }
    return step as unknown as FlowStep
  })
}
