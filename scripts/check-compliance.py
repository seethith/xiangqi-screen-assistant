"""Fail release if notices, fixed assets, GPL sources or private-file exclusions regress."""
from pathlib import Path
import json, hashlib, tarfile, zipfile, re
root=Path(__file__).resolve().parents[1]
manifest=json.loads((root/'dist/compliance/component-manifest.json').read_text())
pkg=json.loads((root/'package.json').read_text())
assert pkg['version']==manifest['version'] and pkg['license']==manifest['applicationLicense']
assert not pkg.get('dependencies'),'Unexpected unreviewed production npm dependency'
covered=set()
for c in manifest['components']:
    assert c['license'] and c['license'] not in ['UNKNOWN','UNLICENSED'],c['name']
    assert c['licenseFiles'],c['name']
    for filename in c['licenseFiles']:assert (root/filename).is_file(),filename
    for f in c['files']:
        p=root/f['path'];assert p.is_file() and hashlib.sha256(p.read_bytes()).hexdigest()==f['sha256'],f['path'];covered.add(f['path'])
    if 'correspondingSource' in c:
        with tarfile.open(root/c['correspondingSource']) as archive:
            members=archive.getmembers();names=[m.name for m in members]
            if c['name']=='FFmpeg in Electron':
                assert 'COPYING.LGPLv2.1' in names and 'configure' in names and 'BUILD.gn' in names
            else:
                assert any(n.endswith('/src/position.cpp') for n in names)
                assert any(n.endswith('/Copying.txt') for n in names)
                assert any('Makefile' in n for n in names)
            assert not any('/../' in n or n.startswith('/') for n in names)
for directory in ['dist/engine','dist/rules','dist/ocr/core']:
    for p in (root/directory).rglob('*'):
        if p.is_file():assert str(p.relative_to(root)) in covered,('Unreviewed asset',str(p))
for f in manifest['sourceArchives']:
    assert hashlib.sha256((root/f['path']).read_bytes()).hexdigest()==f['sha256'],f['path']
assert not list((root/'dist').rglob('*.onnx')),'Desktop-only weights leaked into static distribution'
assert not (root/'dist/engine/xiangqi-83f16c17fe26.nnue').exists()
runtime=root/'desktop/vendor/onnxruntime'
assert not any('directml' in p.name.lower() or 'dxcompiler' in p.name.lower() or 'dxil.' in p.name.lower() for p in runtime.rglob('*'))
for f in json.loads((runtime/'manifest.json').read_text())['files']:
    assert hashlib.sha256((runtime/f['file']).read_bytes()).hexdigest()==f['sha256'],f['file']
worker=(root/'desktop/model-worker.cjs').read_text()
assert "executionProviders:['cpu']" in worker and 'worker_threads' in worker
installer=(root/'desktop/installer.nsi').read_text()
assert 'SetCompressor zlib' in installer and not re.search(r'(WinShell|StdUtils|nsis7z|nsProcess|INetC|UAC)::',installer)
for p in (root/'dist').rglob('*'):
    assert not p.is_symlink() and p.name not in ['.DS_Store','.env'],str(p)
    assert not any(x in p.parts for x in ['private','node_modules','.git']),str(p)
source=root/'dist/source.zip'
if source.exists():
    with zipfile.ZipFile(source) as z:
        names=z.namelist()
        assert 'dist/source.zip' not in names
        assert not any(n.startswith(('evaluation/','.openai/','.git/','node_modules/')) or '.DS_Store' in n for n in names)
        for n in ['scripts/build-windows.cjs','desktop/installer.nsi','desktop/model-worker.cjs','dist/compliance/BUILDING.md']+[e['path'] for e in manifest['sourceArchives']]:assert n in names,n
print('Compliance release checks passed: licenses, hashes, GPL C++ source, private exclusions and CPU-only installer/runtime.')
