# Fonts

- `monaco-kufi.otf` — **Monaco Kufi** by Omar Hassan / Omar Foundry. The font's own
  licence field states: "Completely free, for both personal and commercial use."
  This is the app-wide font (see `components/app-text.tsx`).

- The home screen greeting "أهلا د.يوسف" is drawn from pre-generated outlines
  (`shared/greeting-inline-data.ts`), like the splash greeting, so no font file is bundled
  for it. The Elgharib Yarab RK Gratitude file was tested and is a trial build: every Arabic
  letter renders as the author's credit line, so it cannot be used.

- `dg-tebian-regular.ttf`, `dg-tebian-bold.ttf`, `dg-tebian-black.ttf` — **DG Tebian** by
  Hossam El Deen Ahmed (Design Group), copyright 2021, "All rights reserved". The files carry no
  free-use licence text, so keep the author's permission. Used for all Arabic and English text.

- `monaco-kufi.otf` is now used only for large headings (the brand name and section titles).

The splash greeting "أهلا د.يوسف" is drawn from pre-generated outlines
(`shared/welcome-greeting-data.ts`, built by `scripts/build-welcome-greeting.py`);
the Diwani font file itself is not bundled with the app.
