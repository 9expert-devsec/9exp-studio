"use client";

// Drag to reorder (Asana-style) for content cards (project Content tab) and task
// cards (one content). The WHOLE card is the drag target; every link, button and
// menu inside keeps working on a normal click:
//   - mouse/pen: a drag starts only after moving 6px (a click never drags);
//   - touch: long-press 200ms (5px tolerance), so swiping still scrolls;
//   - keyboard: focus the card itself, Space/Enter to lift, arrows, Space to drop.
// Events from inside dialogs, menus and form fields — and from portals (React
// bubbles portal events through the tree) — never start a drag, and the click that
// ends a drag is swallowed so it can't open a link.
//
// Saving: ONE server action per drop with the container's FULL ordered id list
// (`fullOrder`: on the Content tab a card shows 3 tasks but the list is all of
// them). Optimistic: the new order shows at once and rolls back with an error
// toast if the save fails. Server props win again after the refresh.
//
// Not draggable when `canReorder` is false (no permission), or `blockedReason` is
// set (search/status filter or a due-date sort shows a partial/other order) —
// then each card carries a tooltip saying why.

import { useRef, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { reorderContentAction } from "@/app/(app)/projects/content-actions";
import { reorderTasksAction } from "@/app/(app)/projects/task-actions";
import { toast } from "@/components/ui/Toast";

/** PointerSensor for mouse/pen only; touch is handled by TouchSensor (long-press). */
class MousePenSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown",
      handler: ({ nativeEvent: e }) => e.pointerType !== "touch" && e.isPrimary && e.button === 0,
    },
  ];
}

// Never start a drag from these (inside the card's DOM).
const NO_DRAG = 'dialog, [role="menu"], input, textarea, select, [contenteditable="true"]';

/** Wrap dnd-kit listeners so inner controls and portals keep their own events. */
function guard(listeners) {
  if (!listeners) return {};
  return Object.fromEntries(
    Object.entries(listeners).map(([name, fn]) => [
      name,
      (e) => {
        const t = e.target;
        if (!(t instanceof Element) || !e.currentTarget.contains(t)) return; // portal content
        if (t.closest(NO_DRAG)) return;
        if (e.type === "keydown" && t !== e.currentTarget) return; // Space/Enter on an inner button
        // Nested boards (task cards inside a draggable content card): the innermost wins.
        if (e.nativeEvent.studioSortableClaimed) return;
        e.nativeEvent.studioSortableClaimed = true;
        fn(e);
      },
    ])
  );
}

const LAYOUT = {
  list: { Outer: "ul", Item: "li", outer: "flex flex-col gap-4", strategy: verticalListSortingStrategy, radius: "rounded-[16px]" },
  grid: { Outer: "div", Item: "div", outer: "grid gap-3 md:grid-cols-3", strategy: rectSortingStrategy, radius: "rounded-[14px]" },
};

function SortableItem({ id, Item, radius, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Translate.toString(transform), transition };
  return (
    <Item
      ref={setNodeRef}
      style={style}
      {...attributes}
      role={undefined}
      aria-roledescription="draggable card"
      {...guard(listeners)}
      onDragStart={(e) => e.preventDefault() /* no native link/image drag */}
      className={`relative min-w-0 cursor-grab touch-manipulation outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${radius}`}
    >
      {isDragging ? (
        // Placeholder gap where the card will land (keeps the card's size).
        <div className={`border-2 border-dashed border-brand-500/60 bg-accent-soft/40 ${radius}`}>
          <div className="invisible" aria-hidden="true">
            {children}
          </div>
        </div>
      ) : (
        children
      )}
    </Item>
  );
}

/**
 * @param {{ items: { id: string, node: import("react").ReactNode }[],
 *           fullOrder?: string[], kind: "content" | "tasks", projectId: string, contentId?: string,
 *           canReorder: boolean, blockedReason?: string | null, layout?: "list" | "grid", label: string }} props
 */
export default function SortableBoard({
  items,
  fullOrder,
  kind,
  projectId,
  contentId,
  canReorder,
  blockedReason = null,
  layout = "grid",
  label,
}) {
  const L = LAYOUT[layout];
  const serverIds = items.map((i) => i.id);
  const serverKey = `${serverIds.join(",")}|${(fullOrder ?? []).join(",")}`;
  const [state, setState] = useState({ key: serverKey, ids: null });
  // New server data (after a refresh) replaces any optimistic order.
  if (state.key !== serverKey) setState({ key: serverKey, ids: null });
  const ids = state.key === serverKey && state.ids ? state.ids : serverIds;

  const [activeId, setActiveId] = useState(null);
  const [, startTransition] = useTransition();
  const justDragged = useRef(false);
  const nodeById = new Map(items.map((i) => [i.id, i.node]));

  const sensors = useSensors(
    useSensor(MousePenSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const draggable = canReorder && !blockedReason && ids.length > 1;
  if (!draggable) {
    return (
      <L.Outer className={L.outer} aria-label={label}>
        {ids.map((id) => (
          <L.Item key={id} className="min-w-0" title={canReorder && blockedReason ? blockedReason : undefined}>
            {nodeById.get(id)}
          </L.Item>
        ))}
      </L.Outer>
    );
  }

  const endDrag = () => {
    setActiveId(null);
    document.body.style.cursor = "";
    // The click that follows pointerup must not open a link inside the card.
    setTimeout(() => {
      justDragged.current = false;
    }, 0);
  };

  const onDragEnd = ({ active, over }) => {
    endDrag();
    if (!over || active.id === over.id) return;
    const before = ids;
    const next = arrayMove(ids, ids.indexOf(active.id), ids.indexOf(over.id));
    // Full list: the visible items take their new order in the slots they occupy.
    const all = fullOrder?.length ? fullOrder : before;
    const visible = new Set(next);
    let k = 0;
    const full = all.map((id) => (visible.has(id) ? next[k++] : id));

    setState({ key: serverKey, ids: next }); // optimistic
    startTransition(async () => {
      const res =
        kind === "content" ? await reorderContentAction(projectId, full) : await reorderTasksAction(projectId, contentId, full);
      if (!res?.ok) {
        setState({ key: serverKey, ids: before }); // roll back
        toast(res?.error ?? "Couldn't save the new order.", { tone: "error" });
      }
    });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={({ active }) => {
        justDragged.current = true;
        setActiveId(active.id);
        document.body.style.cursor = "grabbing";
      }}
      onDragEnd={onDragEnd}
      onDragCancel={endDrag}
    >
      <SortableContext items={ids} strategy={L.strategy}>
        <L.Outer
          className={L.outer}
          aria-label={label}
          onClickCapture={(e) => {
            if (justDragged.current) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          {ids.map((id) => (
            <SortableItem key={id} id={id} Item={L.Item} radius={L.radius}>
              {nodeById.get(id)}
            </SortableItem>
          ))}
        </L.Outer>
      </SortableContext>
      <DragOverlay>
        {activeId ? (
          // The lifted card (a visual copy; not interactive, hidden from AT).
          <div aria-hidden="true" inert className={`cursor-grabbing opacity-95 shadow-2xl ring-1 ring-brand-500/40 rotate-1 ${L.radius}`}>
            {nodeById.get(activeId)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
