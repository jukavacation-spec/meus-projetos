import { ScrollArea } from '@/components/ui/scroll-area'

type Stage = {
  id: string
  name: string
  color: string
}

interface KanbanColumnProps {
  stage: Stage
  count: number
  children: React.ReactNode
}

export function KanbanColumn({ stage, count, children }: KanbanColumnProps) {
  return (
    <div className="flex-shrink-0 w-80 flex flex-col bg-muted/30 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: stage.color }}
          />
          <h3 className="font-medium text-sm">{stage.name}</h3>
        </div>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
          {count}
        </span>
      </div>

      {/* Cards */}
      <ScrollArea className="flex-1 p-2">
        {children}
      </ScrollArea>
    </div>
  )
}
