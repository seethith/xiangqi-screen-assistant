// GPL-3.0-or-later. Exercise the actual packaged app, without capturing a screen.
const {spawn}=require('node:child_process');
const executable=process.argv[2];
if(!executable)throw Error('Usage: node scripts/test-release.cjs /path/to/app-executable');
const child=spawn(executable,['--release-self-test'],{stdio:['ignore','pipe','pipe'],env:{...process.env,ELECTRON_ENABLE_LOGGING:'1'}});
let output='';child.stdout.on('data',data=>{output+=data;process.stdout.write(data);});child.stderr.on('data',data=>process.stderr.write(data));
const timer=setTimeout(()=>{child.kill();process.exitCode=1;console.error('Packaged release self-test timed out');},90000);
child.on('error',error=>{clearTimeout(timer);console.error(error);process.exitCode=1;});
child.on('exit',code=>{clearTimeout(timer);if(code!==0||!output.includes('"releaseSelfTest":true')){console.error('Missing successful packaged release self-test result; exit='+code);process.exitCode=1;}});
