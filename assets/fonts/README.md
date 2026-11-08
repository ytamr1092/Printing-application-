# Fonts

- `monaco-kufi.otf` — **Monaco Kufi** by Omar Hassan / Omar Foundry. The font's own
  licence field states: "Completely free, for both personal and commercial use."
  This is the app-wide font (see `components/app-text.tsx`).

- The home screen greeting "أهلا د.يوسف" is drawn from pre-generated outlines
  (`shared/greeting-inline-data.ts`), like the splash greeting, so no font file is bundled
  for it. The Elgharib Yarab RK Gratitude file was tested and is a trial build: every Arabic
  letter renders as the author's credit line, so it cannot be used.

- `dg-trika-regular.ttf`, `dg-trika-bold.ttf` — **DG Trika** by Hossam El Deen Ahmed
  (Design Group; copyright notice: "All rights reserved", no free-use licence text in the
  file, so keep the permission from the author). Used for English letters and Western
  digits: a whole `Text` that has no Arabic uses it, and in mixed text the English runs are
  wrapped in a span (`shared/script-runs.ts`). Arabic stays in Monaco Kufi.

The splash greeting "أهلا د.يوسف" is drawn from pre-generated outlines
(`shared/welcome-greeting-data.ts`, built by `scripts/build-welcome-greeting.py`);
the Diwani font file itself is not bundled with the app.
