// GPL-3.0-or-later. Verify the curated native runtime already supplied with source.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../desktop/vendor/onnxruntime');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
for(const entry of manifest.files){const p=path.join(root,entry.file),data=fs.readFileSync(p);if(crypto.createHash('sha256').update(data).digest('hex')!==entry.sha256)throw Error('Native runtime checksum mismatch: '+entry.file);}
if(!manifest.files.some(e=>e.file.includes('/'+process.platform+'/'+process.arch+'/')))throw Error('No bundled native runtime for '+process.platform+'/'+process.arch);
console.log('Pinned native CPU runtime verified; no downloads or install scripts.');
