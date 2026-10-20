export class AnalysisEngine{
 constructor(onEvent){this.onEvent=onEvent;this.worker=null;this.seq=0;this.ready=false;this.boot=null;this.searching=false;}
 async init(nnue=false){
  if(this.ready)return;if(this.boot)return this.boot;
  this.onEvent({type:'status',text:'正在加载本地引擎与模型…'});
  this.boot=new Promise((resolve,reject)=>{
   this.worker=new Worker('/analysis-worker.js');
   const timer=setTimeout(()=>fail('引擎加载超时，请检查网络后重试。'),45000);
   const fail=text=>{clearTimeout(timer);this.worker?.terminate();this.worker=null;this.ready=false;this.boot=null;reject(Error(text));};
   this.worker.onerror=e=>{if(!this.ready)fail(e.message||'引擎未能启动。');else{this.searching=false;this.onEvent({type:'error',text:'计算中断，请重试。'});this.reset();}};
   this.worker.onmessage=({data})=>{if(data.type==='ready'){clearTimeout(timer);this.ready=true;resolve();}else if(data.type==='error'&&!this.ready){fail(data.text);}if(data.id===undefined||data.id===this.seq){if(data.type==='done'||data.type==='error')this.searching=false;this.onEvent(data);}};
   this.worker.postMessage({type:'init',enhanced:globalThis.crossOriginIsolated&&typeof SharedArrayBuffer==='function',nnue});
  });return this.boot;
 }
 async analyze(position,options){const id=++this.seq;await this.init(options.strength==='enhanced');if(id!==this.seq)return;this.searching=true;this.worker.postMessage({type:'analyze',id,...position,...options});return id;}
 stop(){this.seq++;this.searching=false;this.worker?.postMessage({type:'stop'});}
 reset(){this.stop();this.worker?.terminate();this.worker=null;this.ready=false;this.boot=null;}
}
