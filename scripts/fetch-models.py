"""Fetch the selected upstream pretrained models, pinned by revision and SHA-256.
No API key or screen upload is required. Keep TLS certificate verification enabled.
"""
from pathlib import Path
import json,hashlib,subprocess
root=Path(__file__).resolve().parents[1]/'desktop/models'
for entry in json.loads((root/'manifest.json').read_text())['models']:
 p=root/entry['file']
 if p.exists() and hashlib.sha256(p.read_bytes()).hexdigest()==entry['sha256']:
  print('Verified',entry['file']);continue
 partial=p.with_suffix('.download')
 subprocess.run(['curl','--fail','--location','--connect-timeout','15','--max-time','300',entry['url'],'--output',str(partial)],check=True)
 if partial.stat().st_size!=entry['bytes'] or hashlib.sha256(partial.read_bytes()).hexdigest()!=entry['sha256']:raise RuntimeError('Model hash mismatch: '+entry['file'])
 partial.replace(p);print('Fetched and verified',entry['file'])
