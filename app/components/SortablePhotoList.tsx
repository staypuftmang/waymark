"use client";

import { useState, ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Photo } from "@/app/lib/types";

export type DragHandleProps = {
  ref: (node: HTMLElement | null) => void;
  [key: string]: unknown;
};

interface SortablePhotoListProps {
  photos: Photo[];
  onReorder: (photos: Photo[]) => void;
  disabled?: boolean;
  strategy?: "vertical" | "horizontal";
  /**
   * Render a single item. Receives photo, index, total, drag-handle props
   * (undefined when list is disabled so the handle UI can hide entirely),
   * and isDragging flag.
   */
  renderItem: (
    photo: Photo,
    index: number,
    total: number,
    handleProps: Record<string, unknown> | undefined,
    isDragging: boolean
  ) => ReactNode;
  /** Optional preview shown in the DragOverlay while dragging */
  renderOverlay?: (photo: Photo) => ReactNode;
}

interface SortableItemProps {
  photo: Photo;
  index: number;
  total: number;
  renderItem: SortablePhotoListProps["renderItem"];
}

function SortableItem({ photo, index, total, renderItem }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: photo.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 100 : "auto",
  };

  const handleProps = {
    ref: setActivatorNodeRef,
    ...attributes,
    ...listeners,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {renderItem(photo, index, total, handleProps, isDragging)}
    </div>
  );
}

export default function SortablePhotoList({
  photos,
  onReorder,
  disabled = false,
  strategy = "vertical",
  renderItem,
  renderOverlay,
}: SortablePhotoListProps) {
  const [activeId, setActiveId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(Number(e.active.id));
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const oldIndex = photos.findIndex((p) => p.id === active.id);
    const newIndex = photos.findIndex((p) => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(photos, oldIndex, newIndex));
  };

  const handleDragCancel = () => setActiveId(null);

  const activePhoto = activeId !== null ? photos.find((p) => p.id === activeId) ?? null : null;

  // If disabled, render without DnD wrappers — no drag, handle UI hidden.
  if (disabled) {
    return (
      <>
        {photos.map((p, i) =>
          // Pass undefined so renderItem can conditionally hide the handle.
          renderItem(p, i, photos.length, undefined, false)
        )}
      </>
    );
  }

  const strategyImpl =
    strategy === "horizontal" ? horizontalListSortingStrategy : verticalListSortingStrategy;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={photos.map((p) => p.id)} strategy={strategyImpl}>
        {photos.map((p, i) => (
          <SortableItem
            key={p.id}
            photo={p}
            index={i}
            total={photos.length}
            renderItem={renderItem}
          />
        ))}
      </SortableContext>
      <DragOverlay dropAnimation={null}>
        {activePhoto && renderOverlay ? renderOverlay(activePhoto) : null}
      </DragOverlay>
    </DndContext>
  );
}
