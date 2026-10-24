import { useMemo, useRef, useState } from "react";
import { PanResponder } from "react-native";

import { LONG_PRESS_DRAG_MS } from "@/components/use-drag-reorder";
import { gridTargetIndex } from "@/shared/workflow-files";

const SCROLL_SLOP = 8;

type Options = {
  index: number;
  total: number;
  cols: number;
  cellWidth: number;
  cellHeight: number;
  /** Mirror horizontal movement (right-to-left grids). */
  mirror: boolean;
  /** Move the cell to a new slot. */
  onMove: (from: number, to: number) => void;
};

type TouchEventLike = { nativeEvent?: { pageX?: number; pageY?: number } };

/**
 * Press-and-hold then drag a grid cell anywhere. The cell follows the finger
 * (`offsetX/offsetY`) and jumps to the slot under it; a quick tap or moving
 * before the hold finishes (scrolling) never starts a drag.
 */
export function useGridDragReorder({
  index,
  total,
  cols,
  cellWidth,
  cellHeight,
  mirror,
  onMove,
}: Options) {
  const [dragging, setDragging] = useState(false);
  const [delta, setDelta] = useState({ dx: 0, dy: 0 });
  const startIndex = useRef(index);
  const armed = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const latest = useRef({ index, total, cols, cellWidth, cellHeight, mirror, onMove });
  latest.current = { index, total, cols, cellWidth, cellHeight, mirror, onMove };

  const handlers = useMemo(() => {
    const clearTimer = () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      holdTimer.current = null;
    };
    const finish = () => {
      clearTimer();
      armed.current = false;
      setDragging(false);
      setDelta({ dx: 0, dy: 0 });
    };
    const pan = PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: () => armed.current,
      onMoveShouldSetPanResponderCapture: () => armed.current,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        clearTimer();
        startIndex.current = latest.current.index;
        setDelta({ dx: 0, dy: 0 });
        setDragging(true);
      },
      onPanResponderMove: (_, gesture) => {
        const current = latest.current;
        const dx = current.mirror ? -gesture.dx : gesture.dx;
        const target = gridTargetIndex(
          startIndex.current,
          dx,
          gesture.dy,
          current.cols,
          current.cellWidth,
          current.cellHeight,
          current.total,
        );
        if (target !== current.index) current.onMove(current.index, target);
        setDelta({ dx: gesture.dx, dy: gesture.dy });
      },
      onPanResponderRelease: finish,
      onPanResponderTerminate: finish,
    });
    const touch = {
      onTouchStart: (event: TouchEventLike) => {
        clearTimer();
        armed.current = false;
        origin.current = {
          x: event.nativeEvent?.pageX ?? 0,
          y: event.nativeEvent?.pageY ?? 0,
        };
        holdTimer.current = setTimeout(() => {
          armed.current = true;
        }, LONG_PRESS_DRAG_MS);
      },
      onTouchMove: (event: TouchEventLike) => {
        if (armed.current || !holdTimer.current) return;
        const dx = (event.nativeEvent?.pageX ?? 0) - origin.current.x;
        const dy = (event.nativeEvent?.pageY ?? 0) - origin.current.y;
        if (Math.hypot(dx, dy) > SCROLL_SLOP) clearTimer();
      },
      onTouchEnd: () => {
        clearTimer();
        armed.current = false;
      },
      onTouchCancel: () => {
        clearTimer();
        armed.current = false;
      },
    };
    return { ...pan.panHandlers, ...touch };
  }, []);

  // Keep the cell under the finger after it was swapped into a new slot.
  const columns = Math.max(1, Math.trunc(cols));
  const slotShiftX = ((index % columns) - (startIndex.current % columns)) * cellWidth;
  const slotShiftY =
    (Math.floor(index / columns) - Math.floor(startIndex.current / columns)) * cellHeight;
  const sign = mirror ? -1 : 1;

  return {
    handlers,
    dragging,
    offsetX: dragging ? delta.dx - sign * slotShiftX : 0,
    offsetY: dragging ? delta.dy - slotShiftY : 0,
  };
}
