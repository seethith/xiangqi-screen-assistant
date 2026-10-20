// GPL-3.0-or-later. Electron 44 downloads lazily; install its original notices before packaging.
const fs=require('node:fs'),path=require('node:path');
require('electron');
const root=path.dirname(require.resolve('electron/package.json'));
for(const name of ['LICENSE','LICENSES.chromium.html']){
 const file=path.join(root,'dist',name);
 if(!fs.existsSync(file)||fs.statSync(file).size===0)throw Error('Missing original Electron distribution notice: '+name);
}
console.log('Original Electron and Chromium notices are ready for packaging.');
