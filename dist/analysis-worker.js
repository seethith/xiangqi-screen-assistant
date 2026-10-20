// Modified 2026-10-20: use the explicitly CC0 Fairy-Stockfish network by the Pikafish developers.
let engine=null,rules=null,mode='',active=null,pending=null,ready=false,loading=null,barrier=null,watchdog=null,stopped=false;
const send=data=>postMessage(data),settle=()=>{clearTimeout(watchdog);watchdog=null;active=null;if(pending){const job=pending;pending=null;start(job);}};
function output(line){
 if(line==='uciok'||line==='readyok'){if(barrier?.word===line){const resolve=barrier.resolve;barrier=null;resolve();}return;}
 if(!active)return;
 if(line.startsWith('info '))send({type:'info',id:active.id,line});
 if(line.startsWith('bestmove ')){send({type:'done',id:active.id,bestmove:line.split(' ')[1],mode,memory:engine?.HEAPU8?.byteLength||0});settle();}
}
function wait(word,command){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{barrier=null;reject(Error('引擎握手超时'));},10000);barrier={word,resolve:()=>{clearTimeout(timer);resolve();}};engine.postMessage(command);});}
async function init(enhanced,nnue){
 if(loading)return loading;
 loading=(async()=>{
  if(enhanced){try{
   importScripts('/engine/stockfish.js');
   engine=await Stockfish({locateFile:f=>'/engine/'+f,mainScriptUrlOrBlob:'/engine/stockfish.js',INITIAL_MEMORY:134217728});
   engine.addMessageListener(output);await wait('uciok','uci');
   engine.postMessage('setoption name Hash value 16');
   engine.postMessage('setoption name UCI_Variant value xiangqi');engine.postMessage('setoption name Threads value 1');
   if(nnue){send({type:'status',text:'正在加载象棋模型（约 11 MB）…'});
   const response=await fetch('/engine/xiangqi-c07e94a5c7cb.nnue');if(!response.ok)throw Error('模型下载失败');
   const bytes=new Uint8Array(await response.arrayBuffer());engine.FS.writeFile('/xiangqi-c07e94a5c7cb.nnue',bytes);
   engine.postMessage('setoption name EvalFile value /xiangqi-c07e94a5c7cb.nnue');engine.postMessage('setoption name Use NNUE value true');
   }else engine.postMessage('setoption name Use NNUE value false');
   await wait('readyok','isready');mode=nnue?'enhanced':'standard';
  }catch(e){engine?.terminate();engine=null;send({type:'status',text:'增强引擎未能启动，正在切换兼容分析…'});}}
  if(!engine){
   rules=await new Promise((resolve,reject)=>{self.Module={locateFile:f=>'/rules/'+f,onRuntimeInitialized:()=>resolve(self.Module),onAbort:e=>reject(Error(String(e)))};importScripts('/rules/ffish.js');});mode='compatible';
  }
  ready=true;send({type:'ready',mode,memory:engine?.HEAPU8?.byteLength||rules.HEAPU8.byteLength});
 })().catch(e=>send({type:'error',text:e.message||'引擎初始化失败。'}));return loading;
}
async function start(job){
 if(!ready)return;
 active=job;stopped=false;
 if(engine){try{
   engine.postMessage(`setoption name Hash value ${[16,32,64].includes(job.hash)?job.hash:32}`);
   engine.postMessage(`setoption name MultiPV value ${job.multi?3:1}`);
   engine.postMessage(`position fen ${job.baseFen}${job.moves?.length?' moves '+job.moves.join(' '):''}`);
   await wait('readyok','isready');if(!active||active.id!==job.id)return;
   if(stopped){settle();return;}
   send({type:'started',id:job.id,mode});
   watchdog=setTimeout(()=>{if(active?.id===job.id){engine.postMessage('stop');send({type:'error',id:job.id,text:'本次计算超时，请重试。'});}},job.time+12000);
   engine.postMessage(`go movetime ${job.time}`);
  }catch(e){send({type:'error',id:job.id,text:e.message});settle();}
 }else{send({type:'started',id:job.id,mode});try{await fallback(job);}catch(e){send({type:'error',id:job.id,text:'兼容分析失败：'+e.message});}finally{settle();}}
}
const values={p:100,a:200,b:200,n:410,c:450,r:900,k:0};
function evaluate(board){const rows=board.fen().split(' ')[0].split('/');let value=0;rows.forEach((row,y)=>{let x=0;for(const p of row){if(/[1-9]/.test(p)){x+=Number(p);continue;}const red=p===p.toUpperCase(),type=p.toLowerCase();let v=values[type]||0;if(type==='p')v+=(red?9-y:y)*8+((red?y<=4:y>=5)?45:0);if(type==='n'||type==='c')v+=(4-Math.abs(x-4))*5;value+=red?v:-v;x++;}});return board.turn()?value:-value;}
async function fallback(job){
 const board=new rules.Board('xiangqi',job.baseFen);board.pushMoves((job.moves||[]).join(' '));let nodes=0,deadline=performance.now()+job.time,best=null,lastYield=performance.now();
 const cancelled=()=>stopped||performance.now()>=deadline;
 function search(depth,alpha,beta,ply){nodes++;if((nodes&127)===0&&cancelled())throw Error('timeout');const moves=board.legalMoves().trim().split(/\s+/).filter(Boolean);if(!moves.length)return{score:-30000+ply,pv:[]};if(board.isGameOver(true))return{score:board.result(true)==='1/2-1/2'?0:-30000+ply,pv:[]};if(depth===0)return{score:evaluate(board),pv:[]};let score=-Infinity,pv=[];
  moves.sort((a,b)=>Number(board.isCapture(b))-Number(board.isCapture(a)));
  for(const move of moves){board.push(move);let child;try{child=search(depth-1,-beta,-alpha,ply+1);}finally{board.pop();}const value=-child.score;if(value>score){score=value;pv=[move,...child.pv];}alpha=Math.max(alpha,value);if(alpha>=beta)break;}return{score,pv};
 }
 try{const root=board.legalMoves().trim().split(/\s+/).filter(Boolean);if(!root.length){send({type:'done',id:job.id,bestmove:'(none)',mode});return;}
  best={score:evaluate(board),pv:[root[0]]};
  for(let depth=1;depth<=8&&!cancelled();depth++){const results=[];let finished=true;
   const ordered=best?[best.pv[0],...root.filter(m=>m!==best.pv[0])]:root;
   for(const move of ordered){if(cancelled()){finished=false;break;}board.push(move);let result;try{result=search(depth-1,-Infinity,Infinity,1);}catch(e){if(e.message==='timeout'){finished=false;break;}throw e;}finally{board.pop();}results.push({score:-result.score,pv:[move,...result.pv]});if(performance.now()-lastYield>40){await new Promise(r=>setTimeout(r,0));lastYield=performance.now();}}
   if(finished&&results.length){results.sort((a,b)=>b.score-a.score);best=results[0];results.slice(0,job.multi?3:1).forEach((r,i)=>send({type:'info',id:job.id,line:`info depth ${depth} multipv ${i+1} score ${Math.abs(r.score)>29000?'mate '+Math.sign(r.score)*Math.max(1,Math.ceil((30000-Math.abs(r.score))/2)):'cp '+r.score} nodes ${nodes} nps ${Math.round(nodes/Math.max(.001,(job.time-deadline+performance.now())/1000))} time ${Math.max(1,Math.round(job.time-deadline+performance.now()))} pv ${r.pv.join(' ')}`}));}
   await new Promise(r=>setTimeout(r,0));
  }
  send({type:'done',id:job.id,bestmove:best.pv[0],mode,memory:rules.HEAPU8.byteLength});
 }finally{board.delete();}
}
onmessage=({data})=>{
 if(data.type==='init'){init(data.enhanced,data.nnue);return;}
 if(data.type==='stop'){pending=null;stopped=true;if(engine&&active)engine.postMessage('stop');return;}
 if(data.type==='analyze'){if(active){pending=data;stopped=true;if(engine)engine.postMessage('stop');}else start(data);}
};
