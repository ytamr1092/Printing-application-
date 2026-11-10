import React, { forwardRef, type ComponentRef } from "react";
import {
  Text as NativeText,
  TextInput as NativeTextInput,
  type TextInputProps,
  type TextProps,
} from "react-native";


/**
 * App-wide font: DG Tebian for both Arabic and English (regular, bold and black files,
 * registered once in app/_layout.tsx).
 */
export const APP_FONT_FAMILY = "DGTebian";
export const APP_FONT_BOLD_FAMILY = "DGTebianBold";
export const APP_FONT_BLACK_FAMILY = "DGTebianBlack";

/** Monaco Kufi, used for large headings only. */
export const DISPLAY_FONT_FAMILY = "MonacoKufi";

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
 * - An explicit fontFamily (an icon font, the display font) still wins.
 * - Weights are ignored: everything uses the regular file (no bold).
 * - letterSpacing is reset because spacing breaks Arabic letters apart.
 */
export function withAppFont(style: unknown) {
  const flat = flattenStyle(style);
  // Bold/black files are intentionally not used: every weight renders as the regular file
  // (the user finds the heavy weights tiring to read). fontWeight is reset so Android adds no fake bold.
  return {
    ...flat,
    fontFamily: flat.fontFamily ?? APP_FONT_FAMILY,
    fontWeight: "normal",
    letterSpacing: 0,
  };
}

export const Text = forwardRef<ComponentRef<typeof NativeText>, TextProps>(
  function Text({ style, ...props }, ref) {
    return <NativeText {...props} ref={ref} style={withAppFont(style) as TextProps["style"]} />;
  },
);

export const TextInput = forwardRef<ComponentRef<typeof NativeTextInput>, TextInputProps>(
  function TextInput({ style, ...props }, ref) {
    return <NativeTextInput ref={ref} {...props} style={withAppFont(style) as TextInputProps["style"]} />;
  },
);
