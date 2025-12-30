'use client'

import { useMemo } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { useKanban } from '@/hooks/useKanban'
import { useKanbanConfig } from '@/hooks/useKanbanConfig'
import { KanbanColumn } from './KanbanColumn'
import { KanbanCard } from './KanbanCard'
import { KanbanToolbar } from './KanbanToolbar'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { FilterX } from 'lucide-react'

interface KanbanBoardProps {
  onCardClick?: (contactId: string) => void
}

export function KanbanBoard({ onCardClick }: KanbanBoardProps) {
  const {
    config,
    isLoading: configLoading,
    updateStackedBy,
    toggleColumnVisibility,
    reorderColumns,
    updateFilters,
    clearFilters,
    activeFiltersCount,
  } = useKanbanConfig()

  const { data, isLoading: dataLoading, error: dataError, moveConversation } = useKanban({
    stackedBy: config.stackedBy,
    hiddenColumns: config.hiddenColumns,
    columnOrder: config.columnOrder,
    filters: config.filters,
  })

  // Buscar todas as colunas (sem filtro) para o menu de visibilidade
  const { data: unfilteredData } = useKanban({
    stackedBy: config.stackedBy,
    hiddenColumns: [], // Sem filtro
    columnOrder: [],
    enableRealtime: false, // Evitar duplicacao de subscricoes
  })

  // Memoizar todas as colunas para evitar re-renders
  const allColumns = useMemo(() => unfilteredData.columns, [unfilteredData.columns])

  // Contar total de conversas filtradas
  const totalConversations = useMemo(() => {
    return Object.values(data.conversations).reduce((acc, convs) => acc + convs.length, 0)
  }, [data.conversations])

  const isLoading = configLoading || dataLoading

  async function handleDragEnd(result: DropResult) {
    const { destination, source, draggableId, type } = result

    if (!destination) return

    // Reordenar colunas
    if (type === 'COLUMN') {
      if (destination.index === source.index) return

      const newColumns = Array.from(data.columns)
      const [removed] = newColumns.splice(source.index, 1)
      newColumns.splice(destination.index, 0, removed)

      // Salvar nova ordem
      const newOrder = newColumns.map(col => col.id)
      reorderColumns(newOrder)
      return
    }

    // Mover card entre colunas
    if (type === 'CARD') {
      if (destination.droppableId === source.droppableId && destination.index === source.index) {
        return
      }

      try {
        await moveConversation(draggableId, destination.droppableId)
      } catch {
        // Error handled silently
      }
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex gap-2 mb-4">
          <Skeleton className="h-8 w-[180px]" />
          <Skeleton className="h-8 w-[120px]" />
        </div>
        <div className="flex gap-4 h-full overflow-x-auto pb-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-shrink-0 w-80">
              <Skeleton className="h-10 w-full mb-4" />
              <Skeleton className="h-32 w-full mb-2" />
              <Skeleton className="h-32 w-full mb-2" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (dataError) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <div className="text-center">
          <p className="text-destructive font-medium mb-2">Erro ao carregar o Kanban</p>
          <p className="text-sm text-muted-foreground mb-4">{dataError.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-primary hover:underline"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  if (data.columns.length === 0 && allColumns.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <KanbanToolbar
          stackedBy={config.stackedBy}
          onStackedByChange={updateStackedBy}
          allColumns={allColumns}
          hiddenColumns={config.hiddenColumns}
          onToggleColumn={toggleColumnVisibility}
          filters={config.filters}
          onFiltersChange={updateFilters}
          activeFiltersCount={activeFiltersCount}
        />
        <div className="flex items-center justify-center flex-1">
          <div className="text-center">
            <p className="text-muted-foreground mb-2">Nenhuma coluna disponível</p>
            <p className="text-sm text-muted-foreground">
              Configure os estágios do Kanban nas configurações
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (data.columns.length === 0 && allColumns.length > 0) {
    return (
      <div className="flex flex-col h-full">
        <KanbanToolbar
          stackedBy={config.stackedBy}
          onStackedByChange={updateStackedBy}
          allColumns={allColumns}
          hiddenColumns={config.hiddenColumns}
          onToggleColumn={toggleColumnVisibility}
          filters={config.filters}
          onFiltersChange={updateFilters}
          activeFiltersCount={activeFiltersCount}
        />
        <div className="flex items-center justify-center flex-1">
          <div className="text-center">
            <p className="text-muted-foreground mb-2">Todas as colunas estão ocultas</p>
            <p className="text-sm text-muted-foreground">
              Use o menu &quot;Colunas&quot; acima para exibir as colunas desejadas
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Empty state quando filtros não retornam resultados
  if (totalConversations === 0 && activeFiltersCount > 0 && data.columns.length > 0) {
    return (
      <div className="flex flex-col h-full">
        <KanbanToolbar
          stackedBy={config.stackedBy}
          onStackedByChange={updateStackedBy}
          allColumns={allColumns}
          hiddenColumns={config.hiddenColumns}
          onToggleColumn={toggleColumnVisibility}
          filters={config.filters}
          onFiltersChange={updateFilters}
          activeFiltersCount={activeFiltersCount}
        />
        <div className="flex items-center justify-center flex-1">
          <div className="text-center">
            <FilterX className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground mb-2">Nenhuma conversa encontrada</p>
            <p className="text-sm text-muted-foreground mb-4">
              Os filtros aplicados não retornaram resultados
            </p>
            <Button variant="outline" onClick={clearFilters}>
              Limpar filtros
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <KanbanToolbar
        stackedBy={config.stackedBy}
        onStackedByChange={updateStackedBy}
        allColumns={allColumns}
        hiddenColumns={config.hiddenColumns}
        onToggleColumn={toggleColumnVisibility}
        filters={config.filters}
        onFiltersChange={updateFilters}
        activeFiltersCount={activeFiltersCount}
      />

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="board" direction="horizontal" type="COLUMN">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="flex gap-4 h-full overflow-x-auto pb-4"
            >
              {data.columns.map((column, index) => (
                <Draggable
                  key={column.id}
                  draggableId={`column-${column.id}`}
                  index={index}
                >
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={snapshot.isDragging ? 'opacity-90' : ''}
                    >
                      <KanbanColumn
                        column={column}
                        count={data.conversations[column.id]?.length || 0}
                        dragHandleProps={provided.dragHandleProps}
                        isDragging={snapshot.isDragging}
                        onHide={() => toggleColumnVisibility(column.id)}
                      >
                        <Droppable droppableId={column.id} type="CARD">
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={`flex-1 min-h-[300px] rounded-md p-1 ${
                                snapshot.isDraggingOver
                                  ? 'bg-primary/10 ring-2 ring-primary/30 ring-inset'
                                  : ''
                              }`}
                            >
                              {data.conversations[column.id]?.map((conversation, index) => (
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
                                      style={provided.draggableProps.style}
                                    >
                                      <KanbanCard
                                        conversation={conversation}
                                        isDragging={snapshot.isDragging}
                                        onClick={onCardClick}
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
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  )
}
