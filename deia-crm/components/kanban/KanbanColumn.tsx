import { GripVertical, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd'
import type { KanbanColumn as KanbanColumnType } from '@/hooks/useKanban'

interface KanbanColumnProps {
  column: KanbanColumnType
  count: number
  children: React.ReactNode
  dragHandleProps?: DraggableProvidedDragHandleProps | null
  isDragging?: boolean
  onHide?: () => void
}

export function KanbanColumn({
  column,
  count,
  children,
  dragHandleProps,
  isDragging,
  onHide,
}: KanbanColumnProps) {
  return (
    <div
      className={`group flex-shrink-0 w-80 flex flex-col bg-muted/30 rounded-lg transition-shadow ${
        isDragging ? 'shadow-lg ring-2 ring-primary/20' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Drag Handle */}
          <div
            {...dragHandleProps}
            className="cursor-grab active:cursor-grabbing p-0.5 -ml-1 hover:bg-muted rounded transition-colors"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>

          {/* Color indicator */}
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: column.color }}
          />

          {/* Name */}
          <h3 className="font-medium text-sm truncate">{column.name}</h3>
        </div>

        <div className="flex items-center gap-1">
          {/* Count badge */}
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
            {count}
          </span>

          {/* Hide button */}
          {onHide && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
                    onClick={onHide}
                  >
                    <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Ocultar coluna</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2">
        {children}
      </div>
    </div>
  )
}
