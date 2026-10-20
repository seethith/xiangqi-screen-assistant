const api=window.desktopAPI,$=s=>document.querySelector(s);
function update(s){
 $('#mini-turn').textContent=s.turn||'等待棋盘同步';$('#mini-status').textContent=s.status;
 $('#mini-eval').textContent=s.evaluation;$('#mini-move').textContent=s.move;
 $('#mini-guide').hidden=!s.instruction;$('#mini-from').textContent=s.fromText||'';$('#mini-to').textContent=s.toText||'';$('#mini-instruction').textContent=s.instruction||'';
 $('#mini-hint').textContent=s.hint||'点击“重新读取”选择浏览器或显示器';$('#mini-detail').textContent=s.lastMove||s.detail||'';
 document.body.dataset.level=s.level;
 $('#mini-pause').disabled=!['跟踪中','已暂停','待重新确认','等候棋盘','切回棋局'].includes(s.status);
 $('#mini-pause').textContent=['跟踪中','等候棋盘','切回棋局'].includes(s.status)?'暂停':'继续看棋';
 $('#mini-stop').disabled=s.status.includes('未开始');
}
api.onSummary(update);update(await api.getSummary());
$('#mini-close').onclick=()=>api.closeMini();
$('#mini-show').onclick=()=>api.showMain();
$('#mini-pause').onclick=()=>api.pause();
$('#mini-restart').onclick=()=>api.restart();
$('#mini-stop').onclick=()=>api.stop();
$('#mini-reset-size').onclick=()=>{api.resetMiniSize();$('.mini-more').open=false;};
let gesture=null;
function endGesture(){
 if(!gesture)return;
 const current=gesture;gesture=null;
 if(current.element.hasPointerCapture(current.id))current.element.releasePointerCapture(current.id);
 api.endMiniGesture();
}
for(const [selector,mode] of [['#mini-resize','resize']]){
 const element=$(selector);
 element.onpointerdown=event=>{
  if(event.button!==0)return;
  event.preventDefault();endGesture();
  element.setPointerCapture(event.pointerId);gesture={element,id:event.pointerId};
  api.beginMiniGesture(mode,{x:event.screenX,y:event.screenY}).then(started=>{if(!started)endGesture();}).catch(endGesture);
 };
 element.onpointermove=event=>{if(gesture?.element===element)api.moveMiniGesture({x:event.screenX,y:event.screenY});};
 element.onpointerup=event=>{if(gesture?.element===element)api.moveMiniGesture({x:event.screenX,y:event.screenY});endGesture();};
 element.onpointercancel=endGesture;element.onlostpointercapture=endGesture;
}
window.addEventListener('blur',endGesture);
window.addEventListener('pagehide',endGesture);
$('#mini-resize').onkeydown=event=>{
 const delta={ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,-10],ArrowDown:[0,10]}[event.key];
 if(delta){event.preventDefault();api.resizeMiniBy(...delta);}
};
