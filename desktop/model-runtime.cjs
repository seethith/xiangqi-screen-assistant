// GPL-3.0-or-later. Modified 2026-10-20: isolate native CPU inference in a worker.
// Recognition models: MIT, see models/manifest.json and dist/licenses.html.
const path=require('node:path');
const {Worker}=require('node:worker_threads');
let worker,serial=0;const pending=new Map();
function getWorker(){
 if(worker)return worker;
 const current=new Worker(path.join(__dirname,'model-worker.cjs'));
 worker=current;current.unref();
 const fail=error=>{if(worker!==current)return;worker=undefined;for(const request of pending.values())request.reject(error);pending.clear();};
 current.on('error',fail);current.on('exit',code=>fail(Error('识别线程已退出（'+code+'）')));
 current.on('message',message=>{const request=pending.get(message.id);if(!request)return;pending.delete(message.id);message.error?request.reject(Error(message.error)):request.resolve(message.outputs);if(!pending.size)current.unref();});
 return current;
}
async function infer(kind,input){
 const dims={pose:[1,3,256,256],layout:[1,3,315,280]}[kind];
 if(!dims||!(input instanceof Float32Array)||input.length!==dims.reduce((a,b)=>a*b,1)||!input.every(Number.isFinite))throw Error('识别输入无效');
 if(pending.size>=2)throw Error('识别忙，请稍后重试');
 const current=getWorker(),id=++serial;
 return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});current.ref();try{current.postMessage({id,kind,input});}catch(e){pending.delete(id);if(!pending.size)current.unref();reject(e);}});
}
module.exports={infer};
