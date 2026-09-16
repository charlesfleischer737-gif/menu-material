"""Rebuild static print fonts with fonttools==4.65.0; not needed for app builds."""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

root = Path(__file__).resolve().parent.parent / "public/fonts"
(root / "print").mkdir(exist_ok=True)
for source, output, axes in [
    ("DMSans-Variable.ttf", "DMSans-Semibold.ttf", {"wght": 600, "opsz": 24}),
    ("CormorantGaramond-Variable.ttf", "CormorantGaramond-Semibold.ttf", {"wght": 600}),
]:
    font = TTFont(root / "social" / source)
    instantiateVariableFont(font, axes, inplace=True).save(root / "print" / output)
