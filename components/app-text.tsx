import React, { forwardRef, type ComponentRef } from "react";
import {
  Text as NativeText,
  TextInput as NativeTextInput,
  type TextInputProps,
  type TextProps,
} from "react-native";

/**
 * The app-wide font (Monaco Kufi). The font file is registered once in
 * app/_layout.tsx under this family name.
 */
export const APP_FONT_FAMILY = "MonacoKufi";

function flattenStyle(style: unknown): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  const walk = (value: unknown) => {
    if (!value) return;
    if (Array.isArray(value)) value.forEach(walk);
    else if (typeof value === "object") Object.assign(merged, value);
  };
  walk(style);
  return merged;
}

/**
 * Applies the app font on top of whatever style a screen passes in.
 * - An explicit fontFamily (for example an icon font) still wins.
 * - fontWeight is reset because the font has a single weight and a faux bold
 *   distorts the letter shapes.
 * - letterSpacing is reset because spacing breaks Arabic letters apart.
 */
export function withAppFont(style: unknown) {
  const flat = flattenStyle(style);
  return {
    ...flat,
    fontFamily: flat.fontFamily ?? APP_FONT_FAMILY,
    fontWeight: "normal",
    letterSpacing: 0,
  };
}

export const Text = forwardRef<ComponentRef<typeof NativeText>, TextProps>(
  function Text({ style, ...props }, ref) {
    return <NativeText ref={ref} {...props} style={withAppFont(style) as TextProps["style"]} />;
  },
);

export const TextInput = forwardRef<ComponentRef<typeof NativeTextInput>, TextInputProps>(
  function TextInput({ style, ...props }, ref) {
    return (
      <NativeTextInput ref={ref} {...props} style={withAppFont(style) as TextInputProps["style"]} />
    );
  },
);
