import React from "react";
import Svg, { Path } from "react-native-svg";

import { HERO_PHRASE_PATHS, HERO_PHRASE_VIEW } from "@/shared/hero-phrase-data";

/** "أنجز مستندك بثقة" drawn from calligraphy outlines, so it needs no font file. */
export function HeroPhrase({ width = 220, color }: { width?: number; color: string }) {
  const { x, y, width: viewWidth, height: viewHeight } = HERO_PHRASE_VIEW;
  return (
    <Svg
      width={width}
      height={(viewHeight / viewWidth) * width}
      viewBox={`${x} ${y} ${viewWidth} ${viewHeight}`}
      accessibilityLabel="أنجز مستندك بثقة"
    >
      {HERO_PHRASE_PATHS.map((d, index) => (
        <Path key={index} d={d} fill={color} />
      ))}
    </Svg>
  );
}
