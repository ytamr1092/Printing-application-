import React, { forwardRef, type ComponentRef, type ReactNode } from "react";
import {
  Text as NativeText,
  TextInput as NativeTextInput,
  type TextInputProps,
  type TextProps,
} from "react-native";

import { hasArabic, hasLatin, splitScriptRuns } from "@/shared/script-runs";

/**
 * The app-wide font (Monaco Kufi). The font file is registered once in
 * app/_layout.tsx under this family name.
 */
export const APP_FONT_FAMILY = "MonacoKufi";

/** Elgharib, used only for the personal greeting on the home screen. */
export const GREETING_FONT_FAMILY = "ElgharibGratitude";

/** DG Trika, used for English letters and Western digits (regular and bold files). */
export const LATIN_FONT_FAMILY = "DGTrika";
export const LATIN_BOLD_FONT_FAMILY = "DGTrikaBold";

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

function isBold(weight: unknown) {
  return weight === "bold" || (typeof weight === "string" && Number(weight) >= 700) || (typeof weight === "number" && weight >= 700);
}

/**
 * Applies the app font on top of whatever style a screen passes in.
 * - An explicit fontFamily (for example an icon font) still wins.
 * - fontWeight is reset because Monaco Kufi has a single weight and a faux bold
 *   distorts the letter shapes. English text keeps bold by using the DG Trika bold file.
 * - letterSpacing is reset because spacing breaks Arabic letters apart.
 * Pass `latin` to use DG Trika instead of Monaco Kufi.
 */
export function withAppFont(style: unknown, latin = false) {
  const flat = flattenStyle(style);
  const latinFamily = isBold(flat.fontWeight) ? LATIN_BOLD_FONT_FAMILY : LATIN_FONT_FAMILY;
  return {
    ...flat,
    fontFamily: flat.fontFamily ?? (latin ? latinFamily : APP_FONT_FAMILY),
    fontWeight: "normal",
    letterSpacing: 0,
  };
}

/** Every string or number directly inside the children (not inside nested elements). */
function leafTexts(children: ReactNode, out: string[] = []): string[] {
  if (typeof children === "string" || typeof children === "number") out.push(String(children));
  else if (Array.isArray(children)) children.forEach((child) => leafTexts(child, out));
  return out;
}

/**
 * Decides which font a Text uses.
 * - No English letters or digits: Monaco Kufi, children untouched.
 * - English only: the whole Text uses DG Trika, children untouched.
 * - Arabic mixed with English: Monaco Kufi, with the English runs wrapped in a DG Trika span.
 */
function applyScripts(children: ReactNode, style: unknown): { children: ReactNode; style: unknown } {
  const texts = leafTexts(children);
  if (!texts.some(hasLatin)) return { children, style: withAppFont(style) };
  if (!texts.some(hasArabic)) return { children, style: withAppFont(style, true) };

  const latinStyle = withAppFont(style, true);
  const spanStyle = { fontFamily: latinStyle.fontFamily };
  const span = (text: string, key: string) => (
    <NativeText key={key} style={spanStyle}>
      {text}
    </NativeText>
  );
  const convert = (node: ReactNode, path: string): ReactNode => {
    if (typeof node === "number") return span(String(node), path);
    if (typeof node === "string") {
      if (!hasLatin(node)) return node;
      if (!hasArabic(node)) return span(node, path);
      return splitScriptRuns(node).map((run, index) => (run.latin ? span(run.text, `${path}.${index}`) : run.text));
    }
    if (Array.isArray(node)) return node.map((child, index) => convert(child, `${path}.${index}`));
    return node;
  };
  return { children: convert(children, "t"), style: withAppFont(style) };
}

export const Text = forwardRef<ComponentRef<typeof NativeText>, TextProps>(
  function Text({ style, ...props }, ref) {
    const applied = applyScripts(props.children, style);
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
