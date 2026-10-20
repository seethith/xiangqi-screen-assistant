// Local integration fixture: actual captureStream video, native model, rule
// reconciliation, engine, and desktop/overlay IPC. Fixture images stay private.
import {START_FEN,readFen,writeFen,splitMove} from '/domain.js';
import {detectModelBoards} from '/vision-model.js';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function assert(value,message){if(!value)throw Error(message);}
async function until(predicate,message,ms=16000){const end=performance.now()+ms;while(performance.now()<end){if(predicate())return;await delay(100);}throw Error(message+' '+JSON.stringify(window.__xqTrackingTest?.diagnostic()));}
export async function run(sourceId){
 await window.rulesReady;await until(()=>window.__xqTrackingTest,'tracking UI not ready');
 const test=window.__xqTrackingTest,api=window.desktopAPI,sample=new Image();sample.src='/__fixture.jpg';await sample.decode();
 const canvas=document.createElement('canvas');canvas.width=1180;canvas.height=780;const ctx=canvas.getContext('2d');
 function resetImage(){ctx.fillStyle='#f0f1f2';ctx.fillRect(0,0,1180,780);ctx.drawImage(sample,260,100);}
 resetImage();const [box]=await detectModelBoards(canvas);assert(box,'native locator failed');console.log('TRACKING located',JSON.stringify(box));const points=[{x:box.x,y:box.y},{x:box.right,y:box.bottom}],dx=(box.right-box.x)/8,dy=(box.bottom-box.y)/9;
 // Draw fixture moves on its measured grid, independently of the locator under test.
 const at=i=>({x:294+i%9*50.625,y:125.865+Math.floor(i/9)*50.82}),empty=document.createElement('canvas');empty.width=empty.height=46;const blank=at(65);empty.getContext('2d').drawImage(canvas,blank.x-23,blank.y-23,46,46,0,0,46,46);
 const chess=new (await window.rulesReady).Board('xiangqi');
 function advance(move){
  const [a,b]=splitMove(move).map(at),piece=document.createElement('canvas');piece.width=piece.height=46;piece.getContext('2d').drawImage(canvas,a.x-23,a.y-23,46,46,0,0,46,46);
  assert(chess.push(move),'illegal fixture move '+move);ctx.drawImage(empty,a.x-23,a.y-23);ctx.drawImage(piece,b.x-23,b.y-23);
 }
 const pump=setInterval(()=>ctx.drawImage(canvas,0,0),125);
 const checks=[];$('#time-select').value='3000';
 async function seed(position){console.log('TRACKING seed',position.side);await test.seed({stream:canvas.captureStream(8),sourceId,points,corners:box.corners,flip:box.flip,position});await until(()=>test.state()==='tracking','tracking never started');}
 async function synced(label){const fen=writeFen(readFen(chess.fen()).board,readFen(chess.fen()).side);await until(()=>writeFen(test.position().board,test.position().side)===fen&&test.summary().turnSide===readFen(chess.fen()).side,label);checks.push(label);console.log('TRACKING',label);}
 try{
  await seed(readFen(START_FEN));
  await until(()=>test.summary().arrow&&test.summary().move.includes('红方'),'red recommendation missing (periodic checks must not restart the engine)',22000);
  const before=test.diagnostic().lastSemantic;await delay(2200);assert(test.diagnostic().lastSemantic>before,'static board was never periodically checked');checks.push('static board rechecked without starving 3-second engine search');
  advance('b3e3');await synced('red move switches to black');
  await until(()=>test.summary().move==='等待黑方落子','opponent hint not cleared');assert(!test.summary().arrow,'opponent arrow should be suppressed');assert(document.body.dataset.turn==='opponent','opponent turn missing from UI');
  advance('b10c8');await synced('black move switches to red');
  await until(()=>test.summary().arrow&&test.summary().move.includes('红方'),'red recommendation not refreshed',22000);
  const arrow=await api.getSummary();assert(arrow.turnSide==='w'&&arrow.arrow,'native overlay did not receive red-turn recommendation');checks.push('black reply triggers red guidance and arrow IPC');
  advance('g4g5');advance('g7g6');console.log('TRACKING missed target',chess.fen());await synced('two missed plies synchronize together');
  const same=writeFen(test.position().board,test.position().side);await delay(2200);assert(writeFen(test.position().board,test.position().side)===same,'unchanged frame toggled turn twice');
  await test.stop();resetImage();chess.setFen(START_FEN);await seed({...readFen(START_FEN),side:'b'});
  advance('b3e3');await synced('wrong initial turn corrected from an observed red move');assert(test.summary().lastMove.includes('自动校正'),'correction not explained');
  advance('b10c8');await synced('black reply still switches to red after turn correction');
  await until(()=>test.summary().arrow&&test.summary().move.includes('红方'),'corrected red recommendation missing',22000);
  // The default screen view hides manual-only tools; they remain reachable.
  assert(!$('.desktop-analysis-options').open,'advanced settings expanded by default');assert(getComputedStyle($('.entry-row')).display!=='none'&&getComputedStyle($('.desktop-position-tools')).display==='none','manual tools not separated');
  document.querySelector('[data-view=manual]').click();await until(()=>document.body.dataset.desktopView==='manual','manual workspace switch failed');assert(test.state()==='paused','switching to manual must pause tracking');assert(getComputedStyle($('.turn-editor')).display!=='none','manual turn controls unavailable');
  document.querySelector('[data-view=screen]').click();document.querySelector('#capture-pause').click();await until(()=>test.state()==='tracking'&&test.summary().arrow,'resume failed',22000);
  checks.push('manual tools remain accessible; tracking pauses and resumes');
  return {passed:true,checks,fen:writeFen(test.position().board,test.position().side),summary:test.summary()};
 }finally{clearInterval(pump);chess.delete();}
}
const $=selector=>document.querySelector(selector);
