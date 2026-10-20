"""Generate the auditable 1.5.1 public distribution inventory after intentional changes.
Run check-compliance.py before releasing. This generator is not a license scanner.
"""
from pathlib import Path
import json, hashlib
root=Path(__file__).resolve().parents[1]
out=root/'dist/compliance'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
components=[]
def add(name,version,license,files,licenses,source,**extra):
    paths=sorted(set(p for pattern in files for p in root.glob(pattern) if p.is_file()))
    assert paths or not files,name
    components.append(dict(name=name,version=version,license=license,source=source,licenseFiles=licenses,files=[dict(path=str(p.relative_to(root)),bytes=p.stat().st_size,sha256=sha(p)) for p in paths],**extra))
add('Fairy-Stockfish WASM','1.1.12','GPL-3.0-or-later',['dist/engine/stockfish.*','dist/engine/uci.js','dist/engine/AUTHORS','dist/engine/Copying.txt','dist/engine/package.json'],['dist/engine/Copying.txt','dist/engine/AUTHORS'],'https://github.com/fairy-stockfish/fairy-stockfish.wasm/tree/b2e693ef1e111233ce3fb40685921708b3276ed6',correspondingSource='dist/compliance/sources/fairy-stockfish-nnue.wasm-1.1.12-source.tar.gz',modified=False)
add('ffish','0.7.10','GPL-3.0-or-later',['dist/rules/*'],['dist/rules/Copying.txt','dist/rules/AUTHORS'],'https://github.com/ianfab/Fairy-Stockfish/tree/43b66c8abfebfcab893a3a4c349aa790d18df148',correspondingSource='dist/compliance/sources/ffish-0.7.10-source.tar.gz',modified=False)
add('Fairy-Stockfish Xiangqi NNUE (Pikafish developers)','c07e94a5c7cb','CC0-1.0',['dist/engine/*.nnue'],['dist/licenses/CC0-1.0.txt','dist/compliance/evidence/fairy-xiangqi-CC0-declaration.md'],'https://fairy-stockfish.github.io/nnue/',download='https://drive.google.com/uc?export=download&id=18-zDt7z4H9_IQVvcWIvndnKjC5LZhAfm',licenseDeclaration='https://github.com/official-pikafish/Networks/blob/a238f8da2df269c28fec0e2bd2ca0ffd241f83fe/README.md',modified=False)
for name,patterns,notice in [('Tesseract.js',['dist/ocr/tesseract.min.js','dist/ocr/worker.min.js','dist/ocr/*.LICENSE.txt'],'tesseract-js'),('Tesseract.js Core',['dist/ocr/core/*'],'tesseract-core')]:
    add(name,'7.0.0','Apache-2.0',patterns,['dist/licenses/'+notice+'.txt','dist/compliance/ocr-notices.txt'],'https://github.com/naptha/'+('tesseract.js-core' if 'Core' in name else 'tesseract.js'),modified=False)
assets=json.loads((root/'dist/ocr/recognition-assets.json').read_text())
for entry in assets:
    font=entry['file'].endswith('.woff')
    add('XQ Recognition (LXGW WenKai subset)' if font else entry['file'],'sha256:'+entry['sha256'],'OFL-1.1' if font else 'Apache-2.0',['dist/ocr/'+entry['file']],['dist/licenses/wenkai-ofl.txt' if font else 'dist/licenses/tessdata-apache-2.0.txt'],entry['source'],modified=font,changes='Subset to Xiangqi characters and renamed XQ Recognition' if font else 'Unmodified gzip data')
models=json.loads((root/'desktop/models/manifest.json').read_text())
add('Chinese_Chess_Recognition pose and layout models',models['modelRevision'],'MIT',['desktop/models/*.onnx'],['dist/licenses/recognition-models-mit.txt','dist/compliance/evidence/recognition-model-card.md'],models['modelSource']+'/tree/'+models['modelRevision'],modified=False,licenseEvidence='MIT declaration in fixed HF repository README; no independent training-dataset rights assessment is claimed')
add('FFmpeg in Electron','Chromium 152 / 2b68d2babae73714846961fb0ee47e3b3d2e39a9','LGPL-2.1-or-later',['dist/compliance/sources/ffmpeg-2b68d2babae-source.tar.gz','dist/compliance/sources/electron-44.5.1-ffmpeg.patch'],['dist/licenses/ffmpeg-LGPL-2.1.txt'],'https://chromium.googlesource.com/chromium/third_party/ffmpeg/+/2b68d2babae73714846961fb0ee47e3b3d2e39a9',correspondingSource='dist/compliance/sources/ffmpeg-2b68d2babae-source.tar.gz',modified=False,scope='Library bundled unchanged inside Electron; original Chromium source and Electron loader-path patch supplied')
add('ONNX Runtime native CPU (Node/Common + CPU runtime)','1.30.0','MIT',['desktop/vendor/onnxruntime/**/*'],['dist/licenses/onnxruntime-mit.txt','dist/licenses/onnxruntime-third-party.txt','dist/licenses/onnxruntime-windows-third-party.txt','dist/licenses/node-addon-api-mit.txt','dist/licenses/cmake-js-mit.txt'],'https://github.com/microsoft/onnxruntime/tree/v1.30.0',modified=True,distribution='Node/Common JS imports made relative; Mac official native arm64; Windows binding rebuilt without GPU flags against official CPU DLL; no DirectML/GPU providers')
for folder in ['ocr-third-party','ocr-bundled']:
    entries=json.loads((root/'dist/licenses'/folder/'provenance.json').read_text())
    license_names={'leptonica':'BSD-2-Clause','tesseract':'Apache-2.0','giflib':'MIT','libjpeg':'IJG','libpng':'Libpng','libtiff':'libtiff','libwebp':'BSD-3-Clause','zlib':'Zlib','openlibm':'MIT AND BSD-2-Clause AND ISC AND LicenseRef-SunPro'}
    for e in entries:
        notices=e.get('licenseFiles',[e.get('file')])
        add(e['name'],e.get('version',e.get('revision')),e.get('license',license_names.get(e['name'])),[],['dist/licenses/'+folder+'/'+n for n in notices],e['source'],scope='Embedded in unchanged OCR distribution; OpenLibm test sources are not runtime components' if e['name']=='openlibm' else 'Embedded OCR dependency',modified=False)
for name,version,license,notice,source,scope in [('Electron','44.5.1','MIT','electron-mit','https://github.com/electron/electron/tree/v44.5.1','Desktop runtime; original LICENSES.chromium.html also retained beside app resources'),('NSIS','3.0.4.1','Zlib','nsis','https://github.com/electron-userland/electron-builder-binaries/releases/tag/nsis-3.0.4.1','Windows installer core and zlib compression only; no nsis-resources plug-ins'),('electron-builder','26.15.3','MIT','electron-builder-mit','https://github.com/electron-userland/electron-builder/tree/v26.15.3','Build tool only; not an application runtime dependency')]:
    add(name,version,license,[],['dist/licenses/'+notice+'.txt'],source,scope=scope)
archives=[dict(path=str(p.relative_to(root)),sha256=sha(p),bytes=p.stat().st_size) for p in sorted((out/'sources').glob('*'))]
document=dict(schemaVersion=1,application='xiangqi-position-assistant',version=json.loads((root/'package.json').read_text())['version'],reviewDate='2026-10-20',applicationLicense='GPL-3.0-or-later',components=components,sourceArchives=archives,sourceBundle='source.zip',buildInstructions='compliance/BUILDING.md',scope='Web assets, packaged desktop models/runtime, Electron supplied notices and Windows installer. Build-only node_modules are not redistributed.',excluded=['evaluation/private/','all user screen captures and logs','third-party game skin test images','DirectML and GPU providers','WinShell and all nsis-resources plug-ins','old xiangqi-83f16c17fe26.nnue'],limitations='Upstream published license declarations are the evidence; this is not a legal opinion or a warranty of upstream ownership/patent clearance.')
(out/'component-manifest.json').write_text(json.dumps(document,ensure_ascii=False,indent=2)+'\n')
print(f'Inventory generated: {len(components)} components, {len(archives)} source archives.')
