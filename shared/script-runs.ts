/**
 * Splits text into Arabic-script and Latin-script runs so each can use its own font
 * (Monaco Kufi for Arabic, DG Trika for English). Pure functions, no React.
 */

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const LATIN = /[A-Za-z0-9]/;

/**
 * A Latin run: letters and digits, plus the punctuation that sits between them
 * ("A4", "200 g/m²", "Wi-Fi", "IPP: 631") and closing marks that stick to the last one.
 */
const LATIN_RUN = /[A-Za-z0-9]+(?:[ .,:;/\-_'"+%²³°()&#@!?×]+[A-Za-z0-9]+)*[%²³°)]*/g;

export type ScriptRun = { text: string; latin: boolean };

export const hasArabic = (text: string) => ARABIC.test(text);

/** True when the text has an English letter or a Western digit. */
export const hasLatin = (text: string) => LATIN.test(text);

/**
 * Splits text into runs. Latin runs are marked `latin: true`; everything else
 * (Arabic, spaces, Arabic-Indic digits, symbols between runs) is `latin: false`.
 * Joined back together the runs always equal the input.
 */
export function splitScriptRuns(text: string): ScriptRun[] {
  const runs: ScriptRun[] = [];
  let last = 0;
  for (const match of text.matchAll(LATIN_RUN)) {
    const start = match.index ?? 0;
    if (start > last) runs.push({ text: text.slice(last, start), latin: false });
    runs.push({ text: match[0], latin: true });
    last = start + match[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last), latin: false });
  return runs;
}
