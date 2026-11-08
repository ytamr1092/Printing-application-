import React from "react";
import Svg, { Path } from "react-native-svg";

import { INLINE_GREETING_PATHS, INLINE_GREETING_VIEW } from "@/shared/greeting-inline-data";

/** "أهلا د.يوسف" drawn from calligraphy outlines, so it needs no font file. */
export function InlineGreeting({ height = 54, color }: { height?: number; color: string }) {
  const { x, y, width, height: viewHeight } = INLINE_GREETING_VIEW;
  const drawnWidth = (width / viewHeight) * height;
  return (
    <Svg
      width={drawnWidth}
      height={height}
      viewBox={`${x} ${y} ${width} ${viewHeight}`}
      accessibilityLabel="أهلا د.يوسف"
    >
      {INLINE_GREETING_PATHS.map((d, index) => (
        <Path key={index} d={d} fill={color} />
      ))}
    </Svg>
  );
}
