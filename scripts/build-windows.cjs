// GPL-3.0-or-later. 2026-10-20: use only NSIS core functionality.
// No nsis-resources DLLs (WinShell, StdUtils, nsis7z, etc.) are embedded.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),pkg=require('../package.json');
const output=path.join(root,'release','v'+pkg.version),appDir=path.join(output,'win-unpacked');
function run(exe,args,options={}){const result=spawnSync(exe,args,{cwd:root,stdio:'inherit',...options});if(result.error)throw result.error;if(result.status)throw Error(exe+' failed: '+result.status);}
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const p=path.join(dir,e.name);if(e.isSymbolicLink())throw Error('Unexpected symlink '+p);return e.isDirectory()?walk(p):[p];});}
const quote=s=>s.replaceAll('$','$$').replaceAll('"','$\\"');
async function main(){
 if(!process.argv.includes('--skip-pack'))run(process.execPath,[require.resolve('electron-builder/cli.js'),'--win','dir','--x64','--publish','never','--config.directories.output='+output]);
 const originalLicense=path.join(appDir,'LICENSE'),namedLicense=path.join(appDir,'LICENSE.electron.txt');
 if(fs.existsSync(originalLicense))fs.renameSync(originalLicense,namedLicense);
 for(const file of [namedLicense,path.join(appDir,'LICENSES.chromium.html')])if(!fs.existsSync(file))throw Error('Missing original Electron distribution notice: '+path.basename(file));
 const files=walk(appDir).sort(),dirs=[...new Set(files.flatMap(f=>{let d=path.dirname(path.relative(appDir,f)),result=[];while(d!=='.'){result.push(d);d=path.dirname(d);}return result;}))].sort((a,b)=>b.length-a.length);
 const install=files.map(f=>{const rel=path.relative(appDir,f),dir=path.dirname(rel);return 'SetOutPath "$INSTDIR'+(dir==='.'?'':'\\'+quote(dir.replaceAll(path.sep,'\\')))+'"\nFile "'+quote(f)+'"';}).join('\n');
 const remove=files.map(f=>'Delete "$INSTDIR\\'+quote(path.relative(appDir,f).replaceAll(path.sep,'\\'))+'"').concat(dirs.map(d=>'RMDir "$INSTDIR\\'+quote(d.replaceAll(path.sep,'\\'))+'"')).join('\n');
 const template=fs.readFileSync(path.join(root,'desktop/installer.nsi'),'utf8');
 const substitutions={VERSION:pkg.version,VERSION_QUAD:pkg.version.split('-')[0].split('+')[0]+'.0',OUTPUT:quote(path.join(output,pkg.build.productName+' Setup '+pkg.version+'.exe')),ROOT:quote(root),INSTALL_FILES:install,REMOVE_FILES:remove};
 const script=template.replace(/@@([A-Z_]+)@@/g,(_,key)=>substitutions[key]);
 fs.mkdirSync(output,{recursive:true});const generated=path.join(output,'installer-generated.nsi');fs.writeFileSync(generated,'\uFEFF'+script,'utf8');
 const tool=await require('app-builder-lib/out/toolsets/windows').getMakeNsisPath(null);
 run(tool.path,['-V3',generated],{env:{...process.env,...tool.env}});
 fs.writeFileSync(path.join(output,'installer-audit.json'),JSON.stringify({version:pkg.version,nsis:'3.0.4.1',compression:'zlib',externalPlugins:[],files:files.length,uninstaller:'deletes only enumerated application files; removes empty folders; preserves user data',script:'desktop/installer.nsi'},null,2)+'\n');
}
main().catch(e=>{console.error(e);process.exit(1);});
