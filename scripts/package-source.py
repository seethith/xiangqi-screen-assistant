from pathlib import Path
import zipfile
root=Path(__file__).resolve().parents[1]
with zipfile.ZipFile(root/'dist/source.zip','w',zipfile.ZIP_DEFLATED) as z:
    for folder in ['dist','scripts','tests','desktop','.github']:
        for p in (root/folder).rglob('*'):
            if p.is_file() and not p.is_symlink() and p.name not in ['source.zip','.DS_Store'] and '__pycache__' not in p.parts and p.suffix!='.onnx' and not any(x in p.parts for x in ['node_modules','build','ort-source','ort-cpu']) and not p.is_relative_to(root/'dist/compliance/legacy'):
                z.write(p,p.relative_to(root))
    for name in ['README.md','LICENSE','package.json','package-lock.json','.gitignore','.gitattributes']:
        z.write(root/name,name)
