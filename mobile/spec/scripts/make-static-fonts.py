#!/usr/bin/env python3
"""Instantiate the static font weights the apps bundle from the official variable fonts.

GENERATES: design/fonts/static/*.ttf  (committed; the app generators only copy them)

The variable sources in design/fonts/ are the files Google Fonts serves to the web
(github.com/google/fonts, ofl/<family>/<Family>[wght].ttf). design/tokens.md §2.1 asks the
apps to ship static instances for pixel parity, so this script pins each weight with
fontTools' instancer and fixes the name table so PostScript names are predictable
(`HankenGrotesk-Medium`, `SofiaSansExtraCondensed-Light`, ...).

Only needed when the variable sources change. Requires fontTools (not a Node dependency):
    python3 -m venv /tmp/ft && /tmp/ft/bin/pip install fonttools
    /tmp/ft/bin/python -I scripts/make-static-fonts.py
"""
import os
import sys

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = os.path.join(ROOT, "design", "fonts")
OUT = os.path.join(FONTS, "static")

STYLE = {300: "Light", 400: "Regular", 500: "Medium", 600: "SemiBold", 700: "Bold"}

# family name, variable source, weights (design/tokens.md §2.1 "Required weights")
FAMILIES = [
    ("Hanken Grotesk", "HankenGrotesk[wght].ttf", [400, 500, 600, 700]),
    ("Sofia Sans Extra Condensed", "SofiaSansExtraCondensed[wght].ttf", [300, 400]),
]


def set_names(font, family, weight):
    style = STYLE[weight]
    ribbi = style in ("Regular", "Bold")
    ps = family.replace(" ", "") + "-" + style
    legacy_family = family if ribbi else f"{family} {style}"
    legacy_sub = style if ribbi else "Regular"
    name = font["name"]
    # Drop the variable-font naming leftovers, then write a clean static set.
    for nid in (1, 2, 3, 4, 6, 16, 17, 21, 22, 25):
        name.removeNames(nameID=nid)
    entries = {
        1: legacy_family,
        2: legacy_sub,
        3: f"{ps};static-instance",
        4: f"{family} {style}",
        6: ps,
        16: family,
        17: style,
    }
    for nid, value in entries.items():
        name.setName(value, nid, 3, 1, 0x409)
        name.setName(value, nid, 1, 0, 0)
    os2 = font["OS/2"]
    os2.usWeightClass = weight
    # fsSelection: bit 0 italic, bit 5 bold, bit 6 regular
    sel = os2.fsSelection & ~((1 << 0) | (1 << 5) | (1 << 6))
    if style == "Bold":
        sel |= 1 << 5
    elif style == "Regular":
        sel |= 1 << 6
    os2.fsSelection = sel
    font["head"].macStyle = 1 if style == "Bold" else 0
    return ps


def main():
    os.makedirs(OUT, exist_ok=True)
    for family, src, weights in FAMILIES:
        path = os.path.join(FONTS, src)
        if not os.path.exists(path):
            sys.exit(f"missing {path}")
        for w in weights:
            font = TTFont(path)
            static = instancer.instantiateVariableFont(font, {"wght": w})
            for tag in ("STAT",):
                if tag in static:
                    del static[tag]
            ps = set_names(static, family, w)
            out = os.path.join(OUT, ps + ".ttf")
            static.save(out)
            print("wrote", os.path.relpath(out, ROOT))


if __name__ == "__main__":
    main()
