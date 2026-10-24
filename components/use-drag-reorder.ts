import { useMemo, useRef, useState } from "react";
import { PanResponder } from "react-native";

import { dragTargetIndex, stepToward } from "@/shared/workflow-files";

type Options = {
  index: number;
  total: number;
  rowHeight: number;
  /** Called to move the row one slot: from its current index to the next. */
  onStep: (from: number, to: number) => void;
  /** Called when the finger first grabs the handle. */
  onStart?: () => void;
};

/**
 * Drag-to-reorder for one list row. The row follows the finger (`offset`) and
 * swaps places with its neighbours as it crosses them, one slot at a time.
 */
export function useDragReorder({ index, total, rowHeight, onStep, onStart }: Options) {
  const [dragging, setDragging] = useState(false);
  const [rawDy, setRawDy] = useState(0);
  const startIndex = useRef(index);
  const latest = useRef({ index, total, rowHeight, onStep, onStart });
  latest.current = { index, total, rowHeight, onStep, onStart };

  const panResponder = useMemo(() => {
    const finish = () => {
      setDragging(false);
      setRawDy(0);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        startIndex.current = latest.current.index;
        setRawDy(0);
        setDragging(true);
        latest.current.onStart?.();
      },
      onPanResponderMove: (_, gesture) => {
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
      },
      onPanResponderRelease: finish,
      onPanResponderTerminate: finish,
    });
  }, []);

  // Distance the row must be shifted so it stays under the finger after it has
  // already been swapped into a new slot.
  const offset = dragging ? rawDy - (index - startIndex.current) * rowHeight : 0;

  return { panHandlers: panResponder.panHandlers, dragging, offset };
}
