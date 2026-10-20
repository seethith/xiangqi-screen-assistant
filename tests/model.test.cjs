const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const data=file=>'data:text/javascript;base64,'+fs.readFileSync(file).toString('base64');const domainURL=data('dist/domain.js'),domain=import(domainURL),model=import(data('dist/vision-model.js'));
const tracking=import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync('dist/model-tracking.js','utf8').replace("'./domain.js'",JSON.stringify(domainURL))).toString('base64'));
global.fetch=undefined;const raw=require('../dist/rules/ffish.js'),rules=raw.calledRun?Promise.resolve(raw):new Promise(r=>raw.onRuntimeInitialized=()=>r(raw));
test('model decodes empty, unknown and joint red/black classes without inventing a side',async()=>{const m=await model,d=Array(90*16).fill(0);for(let i=0;i<90;i++)d[i*16]=1;d[0]=0;d[13]=1;d[16]=0;d[16+6]=.52;d[16+13]=.48;d[32]=0;d[33]=1;const r=m.decodeLayout({data:d});assert.equal(r.board[0],'r');assert.equal(r.board[1],'R');assert.deepEqual(r.missing,[2]);assert.ok(r.uncertain.includes(1));assert.deepEqual(r.sideUncertain,[1]);assert.throws(()=>m.decodeLayout({data:[1]}));});
test('projective warp preserves all four source corners and supports reversed orientation',async()=>{const m=await model,a=[{x:0,y:0},{x:1,y:0},{x:0,y:1},{x:1,y:1}],b=[{x:50,y:20},{x:400,y:30},{x:40,y:500},{x:410,y:510}],f=m.projectiveMap(a,b);for(let i=0;i<4;i++){const p=f(a[i].x,a[i].y);assert.ok(Math.hypot(p.x-b[i].x,p.y-b[i].y)<1e-6);}assert.deepEqual(m.rectangleCorners([b[0],b[3]],true),[b[3],{x:50,y:510},{x:410,y:20},b[0]]);assert.throws(()=>m.projectiveMap(a,[b[0],b[0],b[0],b[0]]));});
test('semantic tracking reconciles one move and a missed reply using actual chess rules',async()=>{const t=await tracking,d=await domain,f=await rules,start=d.readFen(d.START_FEN),b=new f.Board('xiangqi');try{assert.equal(t.matchRecognizedMoves(f,start,{board:start.board,missing:[],uncertain:[]}).state,'unchanged');b.push('b3e3');let observed={board:d.readFen(b.fen()).board,missing:[],uncertain:[]};assert.deepEqual(t.matchRecognizedMoves(f,start,observed).moves,['b3e3']);b.push('b10c8');observed.board=d.readFen(b.fen()).board;assert.deepEqual(t.matchRecognizedMoves(f,start,observed).moves,['b3e3','b10c8']);observed.missing=[0];assert.equal(t.matchRecognizedMoves(f,start,observed).state,'uncertain');observed.missing=[];observed.uncertain=[64];assert.equal(t.matchRecognizedMoves(f,start,observed).state,'uncertain');observed.uncertain=[];assert.equal(t.matchRecognizedMoves(f,start,observed,1).state,'uncertain');}finally{b.delete();}});
test('semantic tracking rejects illegal changes and never mutates the confirmed board',async()=>{const t=await tracking,d=await domain,f=await rules,start=d.readFen(d.START_FEN),copy=JSON.stringify(start);const b=start.board.slice();b[49]=b[64];b[64]=null;assert.equal(t.matchRecognizedMoves(f,start,{board:b,missing:[],uncertain:[]}).state,'uncertain');assert.equal(JSON.stringify(start),copy);});
test('pose preprocessing preserves OpenCV centre sampling and black letterbox padding',async()=>{const m=await model,width=12,height=8,data=new Uint8ClampedArray(width*height*4);for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4;data[i]=x*10;data[i+1]=y*15;data[i+2]=50;data[i+3]=255;}const tensor=m.poseTensor({width,height,data});for(const [c,v,mean,std] of [[0,60,123.675,58.395],[1,60,116.28,57.12],[2,50,103.53,57.375]]){assert.ok(Math.abs(tensor[c*65536+128*256+128]-(v-mean)/std)<1e-6);assert.ok(Math.abs(tensor[c*65536]-(-mean/std))<1e-6);}});

test('a black move advances to red, and corrects an incorrectly selected initial turn',async()=>{
 const t=await tracking,d=await domain,f=await rules,b=new f.Board('xiangqi');
 try{
  b.push('b3e3');const before=d.readFen(b.fen());b.push('b10c8');
  const observation={...d.readFen(b.fen()),missing:[],uncertain:[]};
  const normal=t.matchRecognizedMoves(f,before,observation);
  assert.equal(normal.startSide,'b');assert.equal(normal.nextSide,'w');assert.equal(normal.correctedTurn,false);
  const stale={...before,side:'w'},match=t.matchRecognizedMoves(f,stale,observation);
  assert.equal(match.correctedTurn,true);assert.equal(match.startSide,'b');assert.equal(match.nextSide,'w');
  const updated=t.reconcileTrackedPosition(f,stale,match);assert.deepEqual(updated.board,observation.board);assert.equal(updated.side,'w');
  assert.equal(updated.baseFen,d.writeFen(stale.board,'b'));assert.deepEqual(updated.moves,['b10c8']);
  assert.throws(()=>t.reconcileTrackedPosition(f,updated,match),/局面已变化/);
  assert.equal(t.matchRecognizedMoves(f,stale,{board:stale.board,missing:[],uncertain:[]}).state,'unchanged');
 }finally{b.delete();}
});
test('synchronizing missed replies preserves the real side and move history atomically',async()=>{
 const t=await tracking,d=await domain,f=await rules,b=new f.Board('xiangqi');
 try{
  let position={...d.readFen(d.START_FEN),baseFen:d.START_FEN,moves:[],names:[]};
  for(const sequence of [['b3e3'],['b10c8'],['h1g3','h10g8']]){
   for(const move of sequence)assert.ok(b.push(move));
   const observed={board:d.readFen(b.fen()).board,missing:[],uncertain:[]},match=t.matchRecognizedMoves(f,position,observed);
   const original=JSON.stringify(position);position=t.reconcileTrackedPosition(f,position,match);
   assert.equal(position.side,d.readFen(b.fen()).side);assert.deepEqual(position.board,observed.board);
   assert.notEqual(JSON.stringify(position),original);
  }
  assert.deepEqual(position.moves,['b3e3','b10c8','h1g3','h10g8']);assert.equal(position.names.length,4);
 }finally{b.delete();}
});
test('a transient observation or repeated video frame cannot switch the turn',async()=>{
 const t=await tracking,d=await domain,f=await rules,b=new f.Board('xiangqi'),gate=t.createObservationGate();
 try{
  const position=d.readFen(d.START_FEN);b.push('b3e3');const match=t.matchRecognizedMoves(f,position,{board:d.readFen(b.fen()).board,missing:[],uncertain:[]});
  assert.equal(gate.observe(match,1).state,'pending');assert.equal(gate.observe(match,1).state,'pending');
  gate.observe({state:'uncertain'},2);assert.equal(gate.observe(match,3).state,'pending');
  assert.equal(gate.observe(match,4).state,'move');assert.equal(gate.observe(match,5).state,'pending');
  gate.reset();assert.equal(gate.observe(match,6).state,'pending');
  assert.equal(t.semanticProbeDue(1499,0),false);assert.equal(t.semanticProbeDue(1500,0),true);
 }finally{b.delete();}
});
