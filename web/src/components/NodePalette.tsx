import { NODE_CONFIGS } from '../lib/types'

export function NodePalette() {
  const onDragStart = (event: React.DragEvent, type: string) => {
    event.dataTransfer.setData('application/shotflow-type', type)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex gap-1.5 bg-white rounded-lg shadow-md border border-gray-200 px-2 py-1.5">
      {NODE_CONFIGS.map((config) => (
        <div
          key={config.type}
          draggable
          onDragStart={(e) => onDragStart(e, config.type)}
          className="flex items-center gap-1 px-2.5 py-1 rounded cursor-grab hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200"
          title={config.label}
        >
          <span className="text-sm">{config.icon}</span>
          <span className="text-xs font-medium" style={{ color: config.color }}>
            {config.label}
          </span>
        </div>
      ))}
    </div>
  )
}
