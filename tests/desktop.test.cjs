const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const moduleFrom=file=>import('data:text/javascript;base64,'+fs.readFileSync(file).toString('base64'));
const core=moduleFrom('dist/vision-core.js'),domain=moduleFrom('dist/domain.js');
const tile=n=>Array(1200).fill(n);
test('screen tracking infers a unique legal move and rejects an illegal change',async()=>{
 const c=await core,d=await domain,before=Array.from({length:90},()=>tile(220));before[64]=tile(30);before[70]=tile(65);
 const after=before.slice();after[64]=tile(220);after[67]=tile(30);
 const result=c.inferMove(before,after,['b3e3','h3e3'],d.splitMove,[tile(220)]);assert.equal(result.state,'move');assert.equal(result.move,'b3e3');
 assert.equal(c.inferMove(before,after,['h3e3'],d.splitMove,[tile(220)]).state,'uncertain');
 assert.equal(c.inferMove(before,before,['b3e3'],d.splitMove,[tile(220)]).state,'unchanged');
});
test('tracking rejects occlusion and ambiguous moves',async()=>{
 const c=await core,d=await domain,before=Array.from({length:90},()=>tile(220));before[64]=tile(30);before[70]=tile(30);
 const covered=before.map(()=>tile(0));assert.equal(c.inferMove(before,covered,['b3e3'],d.splitMove,[tile(220)]).state,'uncertain');
 const after=before.slice();after[64]=tile(220);after[70]=tile(220);after[67]=tile(30);assert.equal(c.inferMove(before,after,['b3e3','h3e3'],d.splitMove,[tile(220)]).state,'uncertain');
 assert.equal(c.stableFrame(before,covered),false);
});
test('key hints use both sides, comparable depths and suppress shallow guesses',async()=>{
 const c=await core,cp=(rank,score,depth=14)=>({rank,score,depth,scoreType:'cp'});
 assert.equal(c.criticalHint([cp(1,20,3)],'w','w').level,'pending');
 assert.equal(c.criticalHint([cp(1,20),cp(2,-220)],'w','w').level,'critical');
 assert.equal(c.criticalHint([cp(1,20),cp(2,-220,8)],'w','w').level,'normal');
 assert.equal(c.criticalHint([cp(1,300)],'b','w').level,'warning');
 assert.equal(c.criticalHint([{rank:1,scoreType:'mate',score:3,depth:10}],'b','w').text,'对方有连续将杀威胁');
});
test('blank and text-like noise do not create a board',async()=>{
 const c=await core,width=500,height=400,data=new Uint8ClampedArray(width*height*4).fill(255);
 assert.equal(c.detectBoards({data,width,height}).length,0);
 for(let y=40;y<280;y+=25)for(let x=30;x<400;x++)for(let k=0;k<3;k++)data[(y*width+x)*4+k]=0;
 assert.equal(c.detectBoards({data,width,height}).length,0);
});
test('a legal-looking move with other covered pieces is rejected',async()=>{
 const c=await core,d=await domain,before=Array.from({length:90},()=>tile(220));before[64]=tile(30);before[4]=tile(30);
 const after=before.slice();after[64]=tile(220);after[67]=tile(30);after[4]=tile(200);
 assert.equal(c.inferMove(before,after,['b3e3'],d.splitMove,[tile(220)]).state,'uncertain');
 assert.equal(c.stableFrame(before,after),false);
});
test('piece comparison tolerates a small shift without accepting a different tile',async()=>{
 const c=await core,a=tile(220),b=tile(220);for(let y=5;y<15;y++)for(let x=7;x<13;x++)for(let k=0;k<3;k++){a[(y*20+x)*3+k]=30;b[(y*20+x+2)*3+k]=30;}
 assert.ok(c.distance(a,b)>7);assert.equal(c.pieceDistance(a,b),0);assert.ok(c.pieceDistance(a,tile(0))>22);
});

test('overlay avoids the board on Retina and negative-coordinate displays',()=>{
 const {placeOverlay,intersects}=require('../desktop/overlay-layout.cjs');
 for(const area of [{x:0,y:25,width:1440,height:875},{x:-1920,y:0,width:1920,height:1080}]){
  const board={x:area.x+250,y:area.y+100,width:640,height:700},result=placeOverlay(area,board);
  assert.equal(intersects(result,board),false);assert.ok(result.x>=area.x&&result.y>=area.y);assert.ok(result.x+result.width<=area.x+area.width&&result.y+result.height<=area.y+area.height);
 }
});
test('own-window filtering keeps displays with coincident numeric IDs',()=>{
 const {isOwnSource}=require('../desktop/overlay-layout.cjs');
 assert.equal(isOwnSource({id:'screen:123:0'},['window:123:0']),false);
 assert.equal(isOwnSource({id:'window:123:1'},['window:123:0']),true);
 assert.equal(isOwnSource({id:'window:456:0'},['window:123:0']),false);
});

// A display frame queued before the overlay was hidden is not a clean frame.
test('clean capture waits for two delivered video frames and rejects a stalled stream',async()=>{
 const {waitForCaptureFrame}=await moduleFrom('dist/desktop-capture.js');let callback,serial=0,cancelled;
 const video={requestVideoFrameCallback(fn){callback=fn;return ++serial;},cancelVideoFrameCallback(id){cancelled=id;}};
 let done=false;const fresh=waitForCaptureFrame(video,100).then(value=>{done=value;return value;});
 callback();await Promise.resolve();assert.equal(done,false);callback();assert.equal(await fresh,true);
 assert.equal(await waitForCaptureFrame(video,5),false);assert.equal(cancelled,3);assert.equal(await waitForCaptureFrame({}),false);
});
