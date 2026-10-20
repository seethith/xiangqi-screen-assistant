"""Build the portable recognition-only font from official LXGW WenKai Regular.
Usage: python3 scripts/subset-vision-font.py /path/to/LXGWWenKai-Regular.ttf
Requires fontTools. No font is installed in the operating system.
"""
import sys
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont
font = TTFont(sys.argv[1])
options = subset.Options()
options.name_IDs = ['*']
subsetter = subset.Subsetter(options=options)
subsetter.populate(text='帅帥将將仕士相象兵卒车車俥马馬傌炮砲')
subsetter.subset(font)
for record in font['name'].names:
    if record.nameID in [1,3,4,6,16]:
        record.string = ('XQRecognition-Regular' if record.nameID == 6 else 'XQ Recognition').encode(record.getEncoding())
    elif record.nameID in [2,17]:
        record.string = 'Regular'.encode(record.getEncoding())
font.flavor = 'woff'
output = Path(__file__).resolve().parents[1] / 'dist/ocr/xq-recognition.woff'
font.save(output)
print(output, output.stat().st_size)
