#!/usr/bin/env python3
"""
Turns the welcome greeting into SVG outlines from a calligraphy TTF so the app does
not need to ship or load the font:

    python3 scripts/build-welcome-greeting.py /path/to/Calligraphy.ttf

Writes shared/welcome-greeting-data.ts. Needs only fontTools. Letter shapes are
picked with the font's own GSUB isol/init/medi/fina + liga tables.
"""
import json
import sys
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

LINES = ["أهلا", "د.يوسف"]
# Per line: scale (font units -> view box units) and horizontal alignment.
SCALE = [1.5, 0.92]
ALIGN = ["center", "center"]
VIEW_WIDTH = 5200
GAP = 140
SPACE = 400

RIGHT_ONLY = set("اأإآدذرزوةى")
NON_JOIN = set(" .")


DOT = "__dot__"


class SyntheticDot:
    """A round full stop for fonts that have no '.' glyph (radius in font units)."""

    RADIUS = 95
    ADVANCE = 330

    def draw(self, pen):
        r, k = self.RADIUS, 0.5523
        cx, cy = self.ADVANCE / 2, r
        pen.moveTo((cx + r, cy))
        pen.curveTo((cx + r, cy + k * r), (cx + k * r, cy + r), (cx, cy + r))
        pen.curveTo((cx - k * r, cy + r), (cx - r, cy + k * r), (cx - r, cy))
        pen.curveTo((cx - r, cy - k * r), (cx - k * r, cy - r), (cx, cy - r))
        pen.curveTo((cx + k * r, cy - r), (cx + r, cy - k * r), (cx + r, cy))
        pen.closePath()


def joins_next(ch):
    return ch not in RIGHT_ONLY and ch not in NON_JOIN


def joins_prev(ch):
    return ch not in NON_JOIN


def forms(word):
    out = []
    for i, ch in enumerate(word):
        prev = word[i - 1] if i else None
        nxt = word[i + 1] if i + 1 < len(word) else None
        pj = prev is not None and joins_next(prev) and joins_prev(ch)
        nj = nxt is not None and joins_next(ch) and joins_prev(nxt)
        out.append("medi" if pj and nj else "fina" if pj else "init" if nj else "isol")
    return out


def main(font_path):
    font = TTFont(font_path)
    cmap = font.getBestCmap()
    real_glyph_set = font.getGlyphSet()

    class GlyphSet:
        def __getitem__(self, name):
            return SyntheticDot() if name == DOT else real_glyph_set[name]

    glyph_set = GlyphSet()
    hmtx = font["hmtx"]
    gsub = font["GSUB"].table
    feature_lookups = {}
    for record in gsub.FeatureList.FeatureRecord:
        feature_lookups.setdefault(record.FeatureTag, set()).update(record.Feature.LookupListIndex)

    def single(tag):
        mapping = {}
        for index in sorted(feature_lookups.get(tag, [])):
            lookup = gsub.LookupList.Lookup[index]
            if lookup.LookupType == 1:
                for sub in lookup.SubTable:
                    mapping.update(sub.mapping)
        return mapping

    singles = {tag: single(tag) for tag in ("isol", "init", "medi", "fina")}

    def shape(word):
        names = []
        for ch, form in zip(word, forms(word)):
            if ord(ch) not in cmap and ch == ".":
                names.append(DOT)
                continue
            glyph = cmap[ord(ch)]
            names.append(singles[form].get(glyph, glyph))
        for index in sorted(feature_lookups.get("liga", [])):
            lookup = gsub.LookupList.Lookup[index]
            if lookup.LookupType != 4:
                continue
            i = 0
            while i < len(names):
                for sub in lookup.SubTable:
                    hit = None
                    for lig in sub.ligatures.get(names[i], []):
                        n = len(lig.Component)
                        if names[i + 1 : i + 1 + n] == list(lig.Component):
                            hit = (n, lig.LigGlyph)
                            break
                    if hit:
                        names[i : i + 1 + hit[0]] = [hit[1]]
                        break
                i += 1
        return names

    lines = []
    top = 0.0
    for line_text, scale, align in zip(LINES, SCALE, ALIGN):
        sequence = []
        for word_index, word in enumerate(line_text.split(" ")):
            if word_index:
                sequence.append(None)
            sequence += shape(word)
        visual = list(reversed(sequence))  # logical order runs right to left
        x = 0.0
        placed = []
        for name in visual:
            if name is None:
                x += SPACE
                continue
            bounds_pen = BoundsPen(glyph_set)
            glyph_set[name].draw(bounds_pen)
            placed.append((name, x, bounds_pen.bounds))
            x += SyntheticDot.ADVANCE if name == DOT else hmtx[name][0]
        xmin = min(b[0] + gx for _, gx, b in placed if b)
        xmax = max(b[2] + gx for _, gx, b in placed if b)
        ymin = min(-b[3] for _, _, b in placed if b)
        ymax = max(-b[1] for _, _, b in placed if b)
        width = (xmax - xmin) * scale
        left = VIEW_WIDTH - width - 100 if align == "right" else (VIEW_WIDTH - width) / 2
        glyphs = []
        for name, gx, bounds in placed:
            pen = SVGPathPen(glyph_set, ntos=lambda v: str(int(round(v))))
            ox = left + (gx - xmin) * scale
            oy = top - ymin * scale
            glyph_set[name].draw(TransformPen(pen, (scale, 0, 0, -scale, ox, oy)))
            glyphs.append(
                {
                    "d": pen.getCommands(),
                    "x0": round(left + (gx + bounds[0] - xmin) * scale),
                    "x1": round(left + (gx + bounds[2] - xmin) * scale),
                }
            )
        height = (ymax - ymin) * scale
        lines.append({"glyphs": glyphs, "top": round(top), "bottom": round(top + height), "left": round(left), "right": round(left + width)})
        top += height + GAP
    view_height = round(top - GAP)
    body = json.dumps(lines, ensure_ascii=False, separators=(",", ":"))
    out = Path(__file__).resolve().parent.parent / "shared" / "welcome-greeting-data.ts"
    out.write_text(
        "// Generated by scripts/build-welcome-greeting.py - do not edit by hand.\n"
        f"export const GREETING_VIEW = {{ width: {VIEW_WIDTH}, height: {view_height} }};\n"
        "export type GreetingGlyph = { d: string; x0: number; x1: number };\n"
        "export type GreetingLine = { glyphs: GreetingGlyph[]; top: number; bottom: number; left: number; right: number };\n"
        f"export const GREETING_LINES: GreetingLine[] = {body};\n",
        encoding="utf-8",
    )
    print("wrote", out, "view", VIEW_WIDTH, view_height)


if __name__ == "__main__":
    main(sys.argv[1])
