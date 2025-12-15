'use client'

import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { useKanban } from '@/hooks/useKanban'
import { KanbanColumn } from './KanbanColumn'
import { KanbanCard } from './KanbanCard'
import { Skeleton } from '@/components/ui/skeleton'

export function KanbanBoard() {
  const { data, isLoading, moveConversation } = useKanban()

  async function handleDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result

    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    try {
      await moveConversation(draggableId, destination.droppableId)
    } catch (error) {
      console.error('Failed to move conversation:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex gap-4 h-full overflow-x-auto pb-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex-shrink-0 w-80">
            <Skeleton className="h-10 w-full mb-4" />
            <Skeleton className="h-32 w-full mb-2" />
            <Skeleton className="h-32 w-full mb-2" />
          </div>
        ))}
      </div>
    )
  }

  if (data.stages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-muted-foreground mb-2">Nenhum estagio configurado</p>
          <p className="text-sm text-muted-foreground">
            Configure os estagios do Kanban nas configuracoes
          </p>
        </div>
      </div>
    )
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 h-full overflow-x-auto pb-4">
        {data.stages.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            count={data.conversations[stage.id]?.length || 0}
          >
            <Droppable droppableId={stage.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`flex-1 min-h-[200px] transition-colors ${
                    snapshot.isDraggingOver ? 'bg-muted/50' : ''
                  }`}
                >
                  {data.conversations[stage.id]?.map((conversation, index) => (
                    <Draggable
                      key={conversation.id}
                      draggableId={conversation.id}
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                        >
                          <KanbanCard
                            conversation={conversation}
                            isDragging={snapshot.isDragging}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </KanbanColumn>
        ))}
      </div>
    </DragDropContext>
  )
}
