import React, { useMemo, useRef, useState } from "react";
import { Image, PanResponder, StyleSheet, Text, View } from "react-native";

import {
  moveRect,
  rectFromPoints,
  resizeRect,
  type CropHandle,
  type CropRect,
} from "@/shared/pdf-cut";

type Props = {
  /** Rendered page image; when missing a blank sheet with the right shape is shown. */
  imageUri: string | null;
  /** Width / height of the page as displayed. */
  aspect: number;
  rect: CropRect;
  onChange: (rect: CropRect) => void;
  primaryColor: string;
  surfaceColor: string;
  borderColor: string;
  mutedColor: string;
  unavailableLabel: string;
  accessibilityLabel: string;
  maxHeight?: number;
};

const HANDLES: CropHandle[] = ["tl", "tr", "bl", "br", "t", "b", "l", "r"];
const HIT = 40;

/**
 * Crop selection over a page. The selection can be:
 * - dragged from ANYWHERE inside it,
 * - resized from any corner or edge,
 * - redrawn by dragging from anywhere on the page outside it.
 */
export function CropEditor({
  imageUri,
  aspect,
  rect,
  onChange,
  primaryColor,
  surfaceColor,
  borderColor,
  mutedColor,
  unavailableLabel,
  accessibilityLabel,
  maxHeight = 420,
}: Props) {
  const [available, setAvailable] = useState(0);
  const safeAspect = aspect > 0 ? aspect : 0.7071;
  const width = available > 0 ? Math.min(available, maxHeight * safeAspect) : 0;
  const height = width / safeAspect;

  const latest = useRef({ rect, onChange, width, height });
  latest.current = { rect, onChange, width, height };
  const startRect = useRef<CropRect>(rect);
  const drawOrigin = useRef({ x: 0, y: 0 });

  const responders = useMemo(() => {
    const emit = (next: CropRect) => latest.current.onChange(next);
    const common = {
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
    };

    const draw = PanResponder.create({
      ...common,
      onPanResponderGrant: (event) => {
        const { width: w, height: h } = latest.current;
        drawOrigin.current = {
          x: w > 0 ? event.nativeEvent.locationX / w : 0,
          y: h > 0 ? event.nativeEvent.locationY / h : 0,
        };
      },
      onPanResponderMove: (_, gesture) => {
        const { width: w, height: h } = latest.current;
        if (!(w > 0 && h > 0)) return;
        const origin = drawOrigin.current;
        emit(rectFromPoints(origin.x, origin.y, origin.x + gesture.dx / w, origin.y + gesture.dy / h));
      },
    });

    const body = PanResponder.create({
      ...common,
      onPanResponderGrant: () => {
        startRect.current = latest.current.rect;
      },
      onPanResponderMove: (_, gesture) => {
        const { width: w, height: h } = latest.current;
        if (!(w > 0 && h > 0)) return;
        emit(moveRect(startRect.current, gesture.dx / w, gesture.dy / h));
      },
    });

    const handles = Object.fromEntries(
      HANDLES.map((handle) => [
        handle,
        PanResponder.create({
          ...common,
          onPanResponderGrant: () => {
            startRect.current = latest.current.rect;
          },
          onPanResponderMove: (_, gesture) => {
            const { width: w, height: h } = latest.current;
            if (!(w > 0 && h > 0)) return;
            emit(resizeRect(startRect.current, handle, gesture.dx / w, gesture.dy / h));
          },
        }),
      ]),
    ) as Record<CropHandle, ReturnType<typeof PanResponder.create>>;

    return { draw, body, handles };
  }, []);

  const left = rect.x * width;
  const top = rect.y * height;
  const boxWidth = rect.w * width;
  const boxHeight = rect.h * height;
  const dim = "rgba(7,26,43,0.5)";

  const handleStyle = (handle: CropHandle) => {
    const half = HIT / 2;
    switch (handle) {
      case "tl":
        return { left: -half, top: -half, width: HIT, height: HIT };
      case "tr":
        return { right: -half, top: -half, width: HIT, height: HIT };
      case "bl":
        return { left: -half, bottom: -half, width: HIT, height: HIT };
      case "br":
        return { right: -half, bottom: -half, width: HIT, height: HIT };
      case "t":
        return { left: half, right: half, top: -half, height: HIT };
      case "b":
        return { left: half, right: half, bottom: -half, height: HIT };
      case "l":
        return { top: half, bottom: half, left: -half, width: HIT };
      default:
        return { top: half, bottom: half, right: -half, width: HIT };
    }
  };

  return (
    <View
      testID="crop-editor"
      onLayout={(event: { nativeEvent: { layout: { width: number } } }) => setAvailable(event.nativeEvent.layout.width)}
      style={styles.outer}
    >
      {width > 0 ? (
        <View
          accessible
          accessibilityLabel={accessibilityLabel}
          {...responders.draw.panHandlers}
          style={[styles.page, { width, height, backgroundColor: surfaceColor, borderColor }]}
        >
          {imageUri ? (
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <Image source={{ uri: imageUri }} resizeMode="stretch" style={StyleSheet.absoluteFill} />
            </View>
          ) : (
            <View pointerEvents="none" style={styles.placeholder}>
              <Text style={[styles.placeholderText, { color: mutedColor }]}>{unavailableLabel}</Text>
            </View>
          )}

          <View pointerEvents="none" style={[styles.dim, { backgroundColor: dim, left: 0, top: 0, right: 0, height: top }]} />
          <View pointerEvents="none" style={[styles.dim, { backgroundColor: dim, left: 0, top: top + boxHeight, right: 0, bottom: 0 }]} />
          <View pointerEvents="none" style={[styles.dim, { backgroundColor: dim, left: 0, top, width: left, height: boxHeight }]} />
          <View pointerEvents="none" style={[styles.dim, { backgroundColor: dim, left: left + boxWidth, top, right: 0, height: boxHeight }]} />

          <View
            testID="crop-selection"
            style={[styles.selection, { left, top, width: boxWidth, height: boxHeight, borderColor: primaryColor }]}
          >
            <View
              testID="crop-selection-body"
              {...responders.body.panHandlers}
              style={StyleSheet.absoluteFill}
            />
            {HANDLES.map((handle) => (
              <View
                key={handle}
                testID={`crop-handle-${handle}`}
                {...responders.handles[handle].panHandlers}
                style={[styles.handle, handleStyle(handle)]}
              >
                {handle.length === 2 ? <View style={[styles.knob, { backgroundColor: primaryColor }]} /> : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { width: "100%", alignItems: "center" },
  page: { borderWidth: 1, overflow: "hidden", position: "relative" },
  placeholder: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", padding: 12 },
  placeholderText: { fontSize: 11, fontWeight: "700", textAlign: "center" },
  dim: { position: "absolute" },
  selection: { position: "absolute", borderWidth: 2 },
  handle: { position: "absolute", alignItems: "center", justifyContent: "center" },
  knob: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: "#fff" },
});
