import React, { forwardRef, type ComponentRef, type ReactNode } from "react";
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

function weightValue(weight: unknown) {
  if (weight === "bold") return 700;
  if (typeof weight === "number") return weight;
  const parsed = typeof weight === "string" ? Number(weight) : NaN;
  return Number.isFinite(parsed) ? parsed : 400;
}

/**
 * Applies the app font on top of whatever style a screen passes in.
 * - An explicit fontFamily (an icon font, the display font) still wins.
 * - The weight picks the font file (400 regular, 500-700 bold, 800+ black); fontWeight itself
 *   is reset so Android does not add a second, synthetic bold.
 * - letterSpacing is reset because spacing breaks Arabic letters apart.
 */
export function withAppFont(style: unknown) {
  const flat = flattenStyle(style);
  const weight = weightValue(flat.fontWeight);
  const family = weight >= 800 ? APP_FONT_BLACK_FAMILY : weight >= 600 ? APP_FONT_BOLD_FAMILY : APP_FONT_FAMILY;
  return {
    ...flat,
    fontFamily: flat.fontFamily ?? family,
    fontWeight: "normal",
    letterSpacing: 0,
  };
}

export const Text = forwardRef<ComponentRef<typeof NativeText>, TextProps>(
  function Text({ style, ...props }, ref) {
    const applied = { children: props.children, style: withAppFont(style) };
    const merged = { ...props, ref, style: applied.style as TextProps["style"] };
    // Untouched children go through props exactly as the caller wrote them. Rebuilt children are
    // passed as separate arguments so React does not ask for keys on the caller's own elements.
    if (applied.children === props.children) return <NativeText {...merged} />;
    return React.createElement(NativeText, merged, ...[applied.children].flat());
  },
);

export const TextInput = forwardRef<ComponentRef<typeof NativeTextInput>, TextInputProps>(
  function TextInput({ style, ...props }, ref) {
    // What is shown decides the font: typed or default text first, then the placeholder.
    const shown = props.value ?? props.defaultValue ?? props.placeholder ?? "";
    const latin = hasLatin(shown) && !hasArabic(shown);
    return (
      <NativeTextInput ref={ref} {...props} style={withAppFont(style, latin) as TextInputProps["style"]} />
    );
  },
);
