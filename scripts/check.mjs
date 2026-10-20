import {readdirSync,statSync,readFileSync} from 'node:fs';import {resolve} from 'node:path';import {spawnSync} from 'node:child_process';
const root=resolve('dist');for(const name of readdirSync(root).filter(f=>f.endsWith('.js'))){const result=spawnSync(process.execPath,['--check',resolve(root,name)],{encoding:'utf8'});if(result.status){process.stderr.write(result.stderr);process.exit(1);}}
for(const name of readdirSync('desktop').filter(f=>/\.(?:js|cjs)$/.test(f))){const result=spawnSync(process.execPath,['--check',resolve('desktop',name)],{encoding:'utf8'});if(result.status){process.stderr.write(result.stderr);process.exit(1);}}
const html=readFileSync(root+'/index.html','utf8');for(const match of html.matchAll(/(?:src|href)="(\/[^"#]*)"/g)){if(!statSync(root+match[1]).isFile())throw Error('Missing asset '+match[1]);}
console.log('JavaScript syntax and linked assets verified.');
