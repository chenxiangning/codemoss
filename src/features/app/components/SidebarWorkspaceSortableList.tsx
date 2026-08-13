import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type { WorkspaceInfo } from "../../../types";
import { applyWorkspaceReorder } from "../../workspaces/utils/sidebarWorkspaceReorder";

export type SidebarWorkspaceDragChrome = {
  isDragging: boolean;
  /**
   * Attach only to the left collapse/folder button:
   * long-press arms drag and turns that control into a drag entry.
   */
  collapsePointerHandlers: {
    onPointerDown: (event: ReactPointerEvent) => void;
  } | null;
};

type SidebarWorkspaceSortableListProps = {
  groupId: string | null;
  workspaces: WorkspaceInfo[];
  isDragDisabled: boolean;
  onReorder: (orderedWorkspaceIds: string[]) => void;
  renderWorkspace: (
    workspace: WorkspaceInfo,
    drag: SidebarWorkspaceDragChrome | null,
  ) => ReactNode;
};

const LONG_PRESS_MS = 380;
const CANCEL_MOVE_PX = 8;

type ActiveDrag = {
  workspaceId: string;
  pointerId: number;
  fromIndex: number;
  currentIndex: number;
  originX: number;
  originY: number;
  armed: boolean;
};

function resolveHoverIndex(params: {
  clientY: number;
  itemIds: string[];
  itemEls: Map<string, HTMLElement | null>;
}): number {
  const { clientY, itemIds, itemEls } = params;
  let nextIndex = itemIds.length - 1;
  for (let index = 0; index < itemIds.length; index += 1) {
    const el = itemEls.get(itemIds[index] ?? "");
    if (!el) {
      continue;
    }
    const rect = el.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    if (clientY < midY) {
      nextIndex = index;
      break;
    }
    nextIndex = index;
  }
  return Math.max(0, nextIndex);
}

/**
 * Within-group project reorder via long-press on the collapse button.
 * Keeps items in-list (no portal) to avoid the floating-card misplacement bug.
 */
export function SidebarWorkspaceSortableList({
  groupId: _groupId,
  workspaces,
  isDragDisabled,
  onReorder,
  renderWorkspace,
}: SidebarWorkspaceSortableListProps) {
  const canReorder = !isDragDisabled && workspaces.length >= 2;
  const itemElsRef = useRef(new Map<string, HTMLElement | null>());
  const longPressTimerRef = useRef<number | null>(null);
  const activeDragRef = useRef<ActiveDrag | null>(null);
  const baseIdsRef = useRef<string[]>([]);
  const previewIdsRef = useRef<string[] | null>(null);
  const suppressClickRef = useRef(false);
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const [previewIds, setPreviewIds] = useState<string[] | null>(null);

  const baseIds = useMemo(
    () => workspaces.map((workspace) => workspace.id),
    [workspaces],
  );
  baseIdsRef.current = baseIds;
  previewIdsRef.current = previewIds;

  const displayIds = previewIds ?? baseIds;
  const workspaceById = useMemo(() => {
    const map = new Map<string, WorkspaceInfo>();
    workspaces.forEach((workspace) => {
      map.set(workspace.id, workspace);
    });
    return map;
  }, [workspaces]);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const resetDrag = useCallback(() => {
    clearLongPressTimer();
    activeDragRef.current = null;
    setActiveDrag(null);
    setPreviewIds(null);
    previewIdsRef.current = null;
  }, [clearLongPressTimer]);

  const armDrag = useCallback((draft: ActiveDrag) => {
    const armed: ActiveDrag = { ...draft, armed: true };
    activeDragRef.current = armed;
    setActiveDrag(armed);
    const ids = baseIdsRef.current.slice();
    previewIdsRef.current = ids;
    setPreviewIds(ids);
    suppressClickRef.current = true;
  }, []);

  const finishDrag = useCallback(() => {
    const current = activeDragRef.current;
    clearLongPressTimer();
    if (!current?.armed) {
      activeDragRef.current = null;
      setActiveDrag(null);
      setPreviewIds(null);
      previewIdsRef.current = null;
      return;
    }
    const orderedIds =
      applyWorkspaceReorder({
        orderedIds: baseIdsRef.current,
        sourceIndex: current.fromIndex,
        destinationIndex: current.currentIndex,
      }) ?? baseIdsRef.current;
    const base = baseIdsRef.current;
    const changed =
      orderedIds.length === base.length &&
      orderedIds.some((id, index) => id !== base[index]);
    activeDragRef.current = null;
    setActiveDrag(null);
    setPreviewIds(null);
    previewIdsRef.current = null;
    if (changed) {
      onReorder(orderedIds);
    }
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  }, [clearLongPressTimer, onReorder]);

  useEffect(() => {
    if (!activeDrag?.armed) {
      return;
    }

    const onPointerMove = (event: PointerEvent) => {
      const current = activeDragRef.current;
      if (!current || event.pointerId !== current.pointerId || !current.armed) {
        return;
      }
      event.preventDefault();
      const hitIds = previewIdsRef.current ?? baseIdsRef.current;
      const nextIndex = resolveHoverIndex({
        clientY: event.clientY,
        itemIds: hitIds,
        itemEls: itemElsRef.current,
      });
      if (nextIndex === current.currentIndex) {
        return;
      }
      const reordered = applyWorkspaceReorder({
        orderedIds: baseIdsRef.current,
        sourceIndex: current.fromIndex,
        destinationIndex: nextIndex,
      });
      if (!reordered) {
        return;
      }
      const nextDrag = { ...current, currentIndex: nextIndex };
      activeDragRef.current = nextDrag;
      setActiveDrag(nextDrag);
      previewIdsRef.current = reordered;
      setPreviewIds(reordered);
    };

    const onPointerUp = (event: PointerEvent) => {
      const current = activeDragRef.current;
      if (!current || event.pointerId !== current.pointerId) {
        return;
      }
      finishDrag();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        resetDrag();
        suppressClickRef.current = false;
      }
    };

    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeDrag?.armed, finishDrag, resetDrag]);

  useEffect(() => () => clearLongPressTimer(), [clearLongPressTimer]);

  useEffect(() => {
    if (!canReorder && activeDragRef.current) {
      resetDrag();
      suppressClickRef.current = false;
    }
  }, [canReorder, resetDrag]);

  const bindItemRef = useCallback((workspaceId: string, node: HTMLElement | null) => {
    if (node) {
      itemElsRef.current.set(workspaceId, node);
    } else {
      itemElsRef.current.delete(workspaceId);
    }
  }, []);

  const createCollapsePointerHandlers = useCallback(
    (
      workspaceId: string,
      index: number,
    ): SidebarWorkspaceDragChrome["collapsePointerHandlers"] => {
      if (!canReorder) {
        return null;
      }
      return {
        onPointerDown: (event: ReactPointerEvent) => {
          // Only primary button; collapse control is the exclusive long-press entry.
          if (event.button !== 0) {
            return;
          }
          if (activeDragRef.current?.armed) {
            return;
          }

          // Keep the press on this control so short-click can still toggle when not armed.
          event.stopPropagation();

          const draft: ActiveDrag = {
            workspaceId,
            pointerId: event.pointerId,
            fromIndex: index,
            currentIndex: index,
            originX: event.clientX,
            originY: event.clientY,
            armed: false,
          };
          activeDragRef.current = draft;
          clearLongPressTimer();
          longPressTimerRef.current = window.setTimeout(() => {
            const latest = activeDragRef.current;
            if (!latest || latest.workspaceId !== workspaceId || latest.armed) {
              return;
            }
            armDrag(latest);
          }, LONG_PRESS_MS);

          const onEarlyMove = (moveEvent: PointerEvent) => {
            const latest = activeDragRef.current;
            if (!latest || latest.pointerId !== moveEvent.pointerId || latest.armed) {
              return;
            }
            const dx = moveEvent.clientX - latest.originX;
            const dy = moveEvent.clientY - latest.originY;
            if (Math.hypot(dx, dy) > CANCEL_MOVE_PX) {
              // User started a normal gesture before long-press armed → cancel reorder.
              clearLongPressTimer();
              activeDragRef.current = null;
              window.removeEventListener("pointermove", onEarlyMove);
              window.removeEventListener("pointerup", onEarlyUp);
              window.removeEventListener("pointercancel", onEarlyUp);
            }
          };
          const onEarlyUp = (upEvent: PointerEvent) => {
            const latest = activeDragRef.current;
            if (!latest || latest.pointerId !== upEvent.pointerId) {
              return;
            }
            if (!latest.armed) {
              clearLongPressTimer();
              activeDragRef.current = null;
            }
            window.removeEventListener("pointermove", onEarlyMove);
            window.removeEventListener("pointerup", onEarlyUp);
            window.removeEventListener("pointercancel", onEarlyUp);
          };
          window.addEventListener("pointermove", onEarlyMove);
          window.addEventListener("pointerup", onEarlyUp);
          window.addEventListener("pointercancel", onEarlyUp);
        },
      };
    },
    [armDrag, canReorder, clearLongPressTimer],
  );

  const baseIndexById = useMemo(() => {
    const map = new Map<string, number>();
    baseIds.forEach((id, index) => {
      map.set(id, index);
    });
    return map;
  }, [baseIds]);

  return (
    <div
      className={`workspace-sortable-list${activeDrag?.armed ? " is-reordering" : ""}`}
      data-workspace-reorder-list="true"
    >
      {displayIds.map((workspaceId) => {
        const workspace = workspaceById.get(workspaceId);
        if (!workspace) {
          return null;
        }
        const baseIndex = baseIndexById.get(workspaceId) ?? 0;
        const isDragging =
          activeDrag?.armed === true && activeDrag.workspaceId === workspaceId;
        const dragChrome: SidebarWorkspaceDragChrome | null = canReorder
          ? {
              isDragging,
              collapsePointerHandlers: createCollapsePointerHandlers(
                workspaceId,
                baseIndex,
              ),
            }
          : null;

        return (
          <div
            key={workspaceId}
            ref={(node) => bindItemRef(workspaceId, node)}
            className={
              isDragging
                ? "workspace-sortable-item is-dragging"
                : "workspace-sortable-item"
            }
            data-workspace-id={workspaceId}
            onClickCapture={(event) => {
              if (suppressClickRef.current) {
                event.preventDefault();
                event.stopPropagation();
              }
            }}
          >
            {renderWorkspace(workspace, dragChrome)}
          </div>
        );
      })}
    </div>
  );
}
