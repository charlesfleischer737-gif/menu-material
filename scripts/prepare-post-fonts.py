"""Rebuild the Post Maker display fonts with fonttools[woff]; not needed for app builds.

Download the sources from the official Google Fonts repository into one folder
(https://github.com/google/fonts/tree/main/ofl), then run:

    python3 scripts/prepare-post-fonts.py path/to/sources

Sources: instrumentserif/InstrumentSerif-{Regular,Italic}.ttf, anton/Anton-Regular.ttf,
fraunces/Fraunces[SOFT,WONK,opsz,wght].ttf, fraunces/Fraunces-Italic[SOFT,WONK,opsz,wght].ttf
and bricolagegrotesque/BricolageGrotesque[opsz,wdth,wght].ttf, each with its OFL.txt.
Variable fonts become static display instances so browsers and the Node export
tests draw identical letters. TTFs stay for exports and tests; browsers load WOFF2.
"""
import shutil
import sys
from pathlib import Path
from fontTools.pens.recordingPen import RecordingPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

sources = Path(sys.argv[1])
social = Path(__file__).resolve().parent.parent / "public/fonts/social"


def rename(font, family, style):
    for record in font["name"].names:
        if record.nameID in (1, 16):
            record.string = family
        elif record.nameID in (2, 17):
            record.string = style
        elif record.nameID == 4:
            record.string = f"{family} {style}"
        elif record.nameID == 6:
            record.string = f"{family}-{style}".replace(" ", "")


def web(target):
    font = TTFont(target, recalcTimestamp=False)
    font.flavor = "woff2"
    woff2 = target.with_suffix(".woff2")
    font.save(woff2)
    restored = TTFont(woff2)
    assert font.getBestCmap() == restored.getBestCmap()
    assert font["hmtx"].metrics == restored["hmtx"].metrics
    before, after = font.getGlyphSet(), restored.getGlyphSet()
    for name in font.getGlyphOrder():
        a, b = RecordingPen(), RecordingPen()
        before[name].draw(a)
        after[name].draw(b)
        assert a.value == b.value, f"Changed glyph: {target.name}/{name}"
    print(f"{woff2.name}: {woff2.stat().st_size:,} bytes, outlines verified")


for source, output in [
    ("InstrumentSerif-Regular.ttf", "InstrumentSerif-Regular.ttf"),
    ("InstrumentSerif-Italic.ttf", "InstrumentSerif-Italic.ttf"),
    ("Anton-Regular.ttf", "Anton-Regular.ttf"),
]:
    shutil.copyfile(sources / source, social / output)
    web(social / output)

for source, output, axes, family, style in [
    (
        "Fraunces[SOFT,WONK,opsz,wght].ttf",
        "Fraunces-SoftSemiBold.ttf",
        {"opsz": 144, "wght": 600, "SOFT": 100, "WONK": 0},
        "Fraunces Soft",
        "SemiBold",
    ),
    (
        "Fraunces-Italic[SOFT,WONK,opsz,wght].ttf",
        "Fraunces-SoftItalic.ttf",
        {"opsz": 144, "wght": 500, "SOFT": 100, "WONK": 1},
        "Fraunces Soft",
        "Italic",
    ),
    (
        "BricolageGrotesque[opsz,wdth,wght].ttf",
        "BricolageGrotesque-Bold.ttf",
        {"opsz": 96, "wdth": 100, "wght": 700},
        "Bricolage Grotesque",
        "Bold",
    ),
]:
    font = instantiateVariableFont(TTFont(sources / source), axes)
    rename(font, family, style)
    font.save(social / output)
    web(social / output)
