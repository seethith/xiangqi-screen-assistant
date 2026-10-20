import {makeArrow,arrowMarkup,maskArrowFingerprints,describeMove} from '/arrow-geometry.js';
import {detectBoards,boardDifference,inferMove,stableFrame} from '/vision-core.js';
import {recognizeBoard,releaseRecognition,fingerprints} from '/vision.js';
import {readFen,START_FEN,splitMove,writeFen} from '/domain.js';
import {AnalysisEngine} from '/engine-client.js';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function assert(value,text){if(!value)throw Error(text);}
async function image(url){const i=new Image();i.src=url;await i.decode();return i;}
export async function run(capture=false,sourceId=''){
 await window.rulesReady;for(let i=0;i<100&&!document.documentElement.dataset.desktopReady;i++)await delay(50);
 assert(window.desktopAPI,'preload missing');assert(document.querySelector('#capture-start'),'desktop UI missing');assert(crossOriginIsolated,'COOP/COEP unavailable');
 const {detectModelBoards,recognizeModelBoard}=await import('/vision-model.js');
 const sample=await image('/__fixture.jpg'),canvas=document.createElement('canvas');canvas.width=1180;canvas.height=780;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#f0f1f2';ctx.fillRect(0,0,1180,780);ctx.drawImage(sample,260,100);
 const boxes=detectBoards(ctx.getImageData(0,0,1180,780));console.log('DETECTED',JSON.stringify(boxes));
 const box=boxes.find(b=>Math.abs(b.x-293)<8&&Math.abs(b.y-126)<9&&Math.abs(b.right-700)<8&&Math.abs(b.bottom-584)<9);assert(box,'board location did not match real screenshot');
 const points=[{x:box.x,y:box.y},{x:box.right,y:box.bottom}];
 const recognized=await recognizeBoard(canvas,points);const expected=readFen(START_FEN).board;
 console.log('OCR',writeFen(recognized.board));assert(recognized.board.filter(Boolean).length===32,'OCR piece count: '+recognized.board.filter(Boolean).length);assert(JSON.stringify(recognized.board)===JSON.stringify(expected),'OCR not exact: '+writeFen(recognized.board));
 const traditional=await image('/__traditional.png'),traditionalPoints=[{x:104,y:105},{x:1120,y:1249}];
 const traditionalResult=await recognizeBoard(traditional,traditionalPoints,{flip:true});const tradBoard=new (await window.rulesReady).Board('xiangqi');let tradExpected;try{for(const move of ['b3d3','c7c6','b1a3'])assert(tradBoard.push(move),'invalid fixture move');tradExpected=readFen(tradBoard.fen()).board;}finally{tradBoard.delete();}
 console.log('TRADITIONAL',JSON.stringify({fen:writeFen(traditionalResult.board),missing:traditionalResult.missing,uncertain:traditionalResult.uncertain,wrong:traditionalResult.board.map((p,i)=>p!==tradExpected[i]?{i,p,expected:tradExpected[i]}:null).filter(Boolean)}));
 assert(JSON.stringify(traditionalResult.board)===JSON.stringify(tradExpected),'traditional screenshot OCR not exact');const recognitionFixtures=await (await import('/__recognition.js')).runRecognitionFixtures();await releaseRecognition();
 // Simulate an actual opening move using source pixels, including a captured target.
 const moved=document.createElement('canvas');moved.width=canvas.width;moved.height=canvas.height;const out=moved.getContext('2d',{willReadFrequently:true});out.drawImage(canvas,0,0);const dx=(box.right-box.x)/8,dy=(box.bottom-box.y)/9;
 const cx=i=>box.x+i%9*dx,cy=i=>box.y+Math.floor(i/9)*dy;
 // Copy an empty intersection onto b3, then copy its cannon onto e3.
 out.drawImage(canvas,cx(65)-23,cy(65)-23,46,46,cx(64)-23,cy(64)-23,46,46);
 out.drawImage(canvas,cx(64)-23,cy(64)-23,46,46,cx(67)-23,cy(67)-23,46,46);
 const modelBoxes=await detectModelBoards(canvas);assert(modelBoxes.length===1,'pretrained board locator failed');const mb=modelBoxes[0],mp=[{x:mb.x,y:mb.y},{x:mb.right,y:mb.bottom}],modelBefore=await recognizeModelBoard(canvas,mp,{flip:mb.flip,corners:mb.corners}),modelAfter=await recognizeModelBoard(moved,mp,{flip:mb.flip,corners:mb.corners});assert(JSON.stringify(modelBefore.board)===JSON.stringify(expected),'pretrained initial board mismatch');const semanticBoard=new (await window.rulesReady).Board('xiangqi');try{semanticBoard.push('b3e3');assert(JSON.stringify(modelAfter.board)===JSON.stringify(readFen(semanticBoard.fen()).board),'pretrained moved board mismatch');}finally{semanticBoard.delete();}
 const blank=document.createElement('canvas');blank.width=800;blank.height=600;blank.getContext('2d').fillRect(0,0,800,600);assert((await detectModelBoards(blank)).length===0,'pretrained locator accepted a blank screen');
 const before=fingerprints(canvas,points),after=fingerprints(moved,points),board=new (await window.rulesReady).Board('xiangqi');
 let track;try{track=inferMove(before,after,board.legalMoves().split(' '),splitMove,before.filter((_,i)=>!expected[i]));}finally{board.delete();}
 console.log('TRACK',JSON.stringify(track));assert(track.state==='move'&&track.move==='b3e3','opening tracking failed');assert(!stableFrame(before,after),'changed frame considered stable');
 // Render the real SVG overlay, then ensure it neither creates a fake move
 // nor hides an actual move under the suggested line.
 const arrow=makeArrow('b3e3',points,canvas.width,canvas.height),svg=await image('data:image/svg+xml;base64,'+btoa(arrowMarkup(arrow))),withArrow=document.createElement('canvas');withArrow.width=canvas.width;withArrow.height=canvas.height;const ac=withArrow.getContext('2d');ac.drawImage(canvas,0,0);ac.drawImage(svg,0,0);const preview=document.createElement('canvas');preview.width=480;preview.height=531;preview.getContext('2d').drawImage(withArrow,250,90,480,531,0,0,480,531);globalThis.__arrowPreview=preview.toDataURL('image/png');
 const masked=maskArrowFingerprints(fingerprints(withArrow,points),before,points,false,arrow);assert(stableFrame(before,masked,3),'rendered arrow creates a false board change');ac.clearRect(0,0,canvas.width,canvas.height);ac.drawImage(moved,0,0);ac.drawImage(svg,0,0);const movedMasked=maskArrowFingerprints(fingerprints(withArrow,points),before,points,false,arrow);assert(boardDifference(before,movedMasked).filter(d=>d>7).length>=2,'arrow masks out an actual move');
 const guide=describeMove(expected,'b3e3');assert(guide.instruction.includes('向右 3 格')&&guide.fromText==='第 2 列 · 第 8 行','expanded move instructions wrong');
 // Engine tested under the packaged custom origin, not only in Node.
 const engine=new AnalysisEngine(()=>{});let final,latest;engine.onEvent=e=>{if(e.type==='info')latest=e.line;if(e.type==='done')final=e;if(e.type==='error')throw Error(e.text);};
 await engine.analyze({baseFen:'4k4/3R1R3/2N1P4/9/9/9/9/9/9/4K4 w - - 0 1',moves:[]},{time:500,hash:16,multi:true,strength:'standard'});for(let i=0;i<200&&!final;i++)await delay(50);assert(final&&final.mode==='standard','real WASM engine failed on app protocol');engine.reset();
 document.querySelector('#fen-btn').click();document.querySelector('#fen-input').value=START_FEN;document.querySelector('#import-fen').click();
 let actualCapture='not attempted';if(capture){const {sources}=await window.desktopAPI.sources();const source=sources.find(s=>s.id.split(':')[1]===sourceId.split(':')[1]);assert(source,'test window not found: '+sourceId+'; window count '+sources.filter(s=>s.id.startsWith('window:')).length);await window.desktopAPI.selectSource(source.id);const stream=await navigator.mediaDevices.getDisplayMedia({audio:false,video:{frameRate:4}}).catch(e=>{throw Error('getDisplayMedia: '+e.name+' '+e.message);});try{const video=document.createElement('video');video.muted=true;video.srcObject=stream;await video.play();await delay(500);const captured=document.createElement('canvas');captured.width=video.videoWidth;captured.height=video.videoHeight;const cc=captured.getContext('2d',{willReadFrequently:true});cc.drawImage(video,0,0);globalThis.__captureImage=captured.toDataURL('image/png');const small=document.createElement('canvas'),scale=Math.min(1,1280/captured.width,1000/captured.height);small.width=Math.round(captured.width*scale);small.height=Math.round(captured.height*scale);const sc=small.getContext('2d',{willReadFrequently:true});sc.drawImage(captured,0,0,small.width,small.height);const boards=detectBoards(sc.getImageData(0,0,small.width,small.height));assert(boards.length>=1,'no board in actual captured test window '+captured.width+'x'+captured.height);const location=boards[0],p=[{x:location.x/scale,y:location.y/scale},{x:location.right/scale,y:location.bottom/scale}];const actualRecognition=await recognizeBoard(captured,p);await releaseRecognition();assert(JSON.stringify(actualRecognition.board)===JSON.stringify(expected),'actual capture OCR mismatch');actualCapture='passed: own test window';}finally{stream.getTracks().forEach(t=>t.stop());}}
 const icon=document.createElement('canvas');icon.width=icon.height=1024;const ic=icon.getContext('2d');ic.drawImage(await image('/favicon.svg'),0,0,1024,1024);
 return {actualCapture,iconData:icon.toDataURL('image/png'),desktopUI:true,isolated:crossOriginIsolated,geometry:box,ocrPieces:32,traditionalPieces:32,pretrained:{initialExact:true,movedExact:true,blankRejected:true},recognitionFixtures,exactStartingPosition:true,tracking:track.move,arrowTracking:true,expandedGuide:true,engine:final.mode,bestmove:final.bestmove,info:latest};
}

async function until(predicate,text,limit=200){for(let i=0;i<limit;i++){if(predicate())return;await delay(50);}throw Error(text);}
export async function runUI(sourceId){
 document.querySelector('#capture-start').click();await until(()=>document.querySelector('dialog.screen-dialog').open&&document.querySelectorAll('.screen-source').length>0,'source picker missing');document.querySelector('#capture-windows').click();await until(()=>[...document.querySelectorAll('.screen-source')].some(b=>b.dataset.sourceId.split(':')[1]===sourceId.split(':')[1]),'source picker did not show own test window');
 [...document.querySelectorAll('.screen-source')].find(b=>b.dataset.sourceId.split(':')[1]===sourceId.split(':')[1]).click();
 await until(()=>!document.querySelector('#capture-recognize').disabled,'calibration did not locate a board',400);document.querySelector('#capture-recognize').click();
 await until(()=>!document.querySelector('#capture-confirm').hidden,'recognition did not reach confirmation');document.querySelector('#capture-accept').click();
 try{await until(()=>document.querySelector('.desktop-bar').dataset.state==='tracking','tracking did not start: '+document.querySelector('#capture-confirm-text').textContent);}catch(e){throw Error(e.message+' '+JSON.stringify(window.__xqTrackingDiagnostics()));}
 try{await until(()=>window.__xqTrackingTest.summary().move.includes('红方 ·'),'analysis hint did not arrive',400);}catch(e){throw Error(e.message+' '+JSON.stringify(window.__xqTrackingDiagnostics()));}
 assert(document.querySelector('#capture-learn').disabled,'stale calibration must not remain available for learning');return 'passed: source picker, auto calibration, OCR confirmation, local analysis, stale learning guarded';
}
export async function checkLiveMove(){
 try{await until(()=>document.querySelector('#capture-status').textContent.includes('已跟进 炮八平五'),'actual move not tracked: '+document.querySelector('#capture-status').textContent,300);}catch(e){throw Error(e.message+' '+JSON.stringify(window.__xqTrackingDiagnostics()));}
 document.querySelector('#capture-stop').click();await until(()=>document.querySelector('.desktop-bar').dataset.state==='idle','capture did not end');
 return 'passed: cannon move tracked and stream ended';
}
