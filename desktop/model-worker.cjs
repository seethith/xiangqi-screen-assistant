// GPL-3.0-or-later. Native CPU inference in an isolated worker; no screen upload.
const path=require('node:path');
const {parentPort}=require('node:worker_threads');
const unpack=p=>p.replace(/\.asar([/\\])/g,'.asar.unpacked$1');
const ort=require(unpack(path.join(__dirname,'vendor/onnxruntime/node')));
const sessions=new Map();let queue=Promise.resolve();
async function run({id,kind,input}){
 try{
  if(!sessions.has(kind))sessions.set(kind,ort.InferenceSession.create(unpack(path.join(__dirname,'models',kind+'.onnx')),{executionProviders:['cpu'],intraOpNumThreads:2,interOpNumThreads:1,graphOptimizationLevel:'all'}).catch(e=>{sessions.delete(kind);throw e;}));
  const session=await sessions.get(kind),dims=kind==='pose'?[1,3,256,256]:[1,3,315,280];
  const outputs=await session.run({[session.inputNames[0]]:new ort.Tensor('float32',input,dims)});
  parentPort.postMessage({id,outputs:session.outputNames.map(name=>({dims:outputs[name].dims,data:Array.from(outputs[name].data)}))});
 }catch(e){parentPort.postMessage({id,error:e.message});}
}
parentPort.on('message',message=>{queue=queue.then(()=>run(message));});
