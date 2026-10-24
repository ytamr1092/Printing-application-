import { useMemo, useRef, useState } from "react";
import { PanResponder } from "react-native";

import { dragTargetIndex, stepToward } from "@/shared/workflow-files";

/** How long a finger must rest on a row before it can be dragged from anywhere. */
export const LONG_PRESS_DRAG_MS = 250;
/** Finger travel (px) before the hold counts as a scroll and cancels the drag. */
const SCROLL_SLOP = 8;

type Options = {
  index: number;
  total: number;
  rowHeight: number;
  /** Called to move the row one slot: from its current index to the next. */
  onStep: (from: number, to: number) => void;
  /** Called when the finger first grabs the row. */
  onStart?: () => void;
};

type TouchEventLike = { nativeEvent?: { pageX?: number; pageY?: number } };

/**
 * Drag-to-reorder for one list row. The row follows the finger (`offset`) and
 * swaps places with its neighbours as it crosses them, one slot at a time.
 *
 * Two ways to start a drag:
 * - `panHandlers`: put them on a drag handle; dragging starts immediately.
 * - `rowHandlers`: put them on the whole row; press and hold, then drag from
 *   anywhere on the row. Moving before the hold finishes scrolls the page.
 */
export function useDragReorder({ index, total, rowHeight, onStep, onStart }: Options) {
  const [dragging, setDragging] = useState(false);
  const [rawDy, setRawDy] = useState(0);
  const startIndex = useRef(index);
  const armed = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchOrigin = useRef({ x: 0, y: 0 });
  const latest = useRef({ index, total, rowHeight, onStep, onStart });
  latest.current = { index, total, rowHeight, onStep, onStart };

  const { handle, row, rowTouch } = useMemo(() => {
    const clearTimer = () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      holdTimer.current = null;
    };
    const finish = () => {
      clearTimer();
      armed.current = false;
      setDragging(false);
      setRawDy(0);
    };
    const grant = () => {
      clearTimer();
      startIndex.current = latest.current.index;
      setRawDy(0);
      setDragging(true);
      latest.current.onStart?.();
    };
    const move = (_: unknown, gesture: { dy: number }) => {
      const current = latest.current;
      const target = dragTargetIndex(
        startIndex.current,
        gesture.dy,
        current.rowHeight,
        current.total,
      );
      const next = stepToward(current.index, target);
      if (next !== current.index) current.onStep(current.index, next);
      setRawDy(gesture.dy);
    };
    const shared = {
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: grant,
      onPanResponderMove: move,
      onPanResponderRelease: finish,
      onPanResponderTerminate: finish,
    };

    const handlePan = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      ...shared,
    });
    // The row only claims the gesture once the hold finished ("armed"), so
    // taps on buttons and normal page scrolling keep working.
    const rowPan = PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: () => armed.current,
      onMoveShouldSetPanResponderCapture: () => armed.current,
      ...shared,
    });

    const rowTouchHandlers = {
      onTouchStart: (event: TouchEventLike) => {
        clearTimer();
        armed.current = false;
        touchOrigin.current = {
          x: event.nativeEvent?.pageX ?? 0,
          y: event.nativeEvent?.pageY ?? 0,
        };
        holdTimer.current = setTimeout(() => {
          armed.current = true;
        }, LONG_PRESS_DRAG_MS);
      },
      onTouchMove: (event: TouchEventLike) => {
        if (armed.current || !holdTimer.current) return;
        const dx = (event.nativeEvent?.pageX ?? 0) - touchOrigin.current.x;
        const dy = (event.nativeEvent?.pageY ?? 0) - touchOrigin.current.y;
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

    return { handle: handlePan.panHandlers, row: rowPan.panHandlers, rowTouch: rowTouchHandlers };
  }, []);

  // Distance the row must be shifted so it stays under the finger after it has
  // already been swapped into a new slot.
  const offset = dragging ? rawDy - (index - startIndex.current) * rowHeight : 0;

  return {
    panHandlers: handle,
    rowHandlers: { ...row, ...rowTouch },
    dragging,
    offset,
  };
}
