/**
 * The app's type scale, in logical pixels. Use these instead of number literals so
 * every screen stays on the same scale.
 *
 * The app font has a single weight, so size is what separates a title from a hint.
 * Arabic needs room: line height is 1.5 times the size.
 */
export const FONT_SIZE = {
  /** Badges, drag handles, step labels. */
  caption: 12,
  /** Hints, file details, secondary information. */
  secondary: 13,
  /** Buttons, chips, form values, notices and errors. */
  label: 14,
  /** Main interface text, menus, file names, section labels. */
  body: 15,
  /** Sub-headings, window titles. */
  subtitle: 18,
  /** Section headings. */
  title: 22,
  /** Hero and main screen titles. */
  heading: 26,
  /** Personal greeting. */
  display: 28,
} as const;

export type FontSizeToken = keyof typeof FONT_SIZE;

const LINE_HEIGHT_RATIO = 1.5;

export const LINE_HEIGHT = Object.fromEntries(
  Object.entries(FONT_SIZE).map(([name, size]) => [name, Math.round(size * LINE_HEIGHT_RATIO)]),
) as Record<FontSizeToken, number>;
