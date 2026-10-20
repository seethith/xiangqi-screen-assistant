// Image-only geometry and tracking. No platform names, DOM, or network dependency.
export function distance(a,b){let sum=0;for(let i=0;i<a.length;i++)sum+=Math.abs(a[i]-b[i]);return sum/a.length;}
export function pieceDistance(a,b){
 const edge=Math.round(Math.sqrt(a.length/3));if(edge*edge*3!==a.length)return distance(a,b);let best=Infinity;
 for(let sy=-3;sy<=3;sy++)for(let sx=-3;sx<=3;sx++){let sum=0,count=0;for(let y=4;y<edge-4;y++)for(let x=4;x<edge-4;x++)for(let c=0;c<3;c++){sum+=Math.abs(a[(y*edge+x)*3+c]-b[((y+sy)*edge+x+sx)*3+c]);count++;}best=Math.min(best,sum/count);}
 return best;
}
export function boardDifference(a,b){return a.map((tile,i)=>distance(tile,b[i]));}
export function stableFrame(previous,current,threshold=4){return previous&&boardDifference(previous,current).filter(d=>d>threshold).length===0;}
export function inferMove(before,after,legalMoves,splitMove,emptyTiles){
 const diff=boardDifference(before,after),changed=diff.map((v,i)=>v>7?i:-1).filter(i=>i>=0);
 if(!changed.length)return {state:'unchanged'};
 if(changed.length>8)return {state:'uncertain',reason:'画面变化较大，可能被遮挡或棋盘已移动'};
 const candidates=[];
 for(const move of legalMoves){const pair=splitMove(move);if(!pair)continue;const [from,to]=pair;if(diff[from]<7||diff[to]<7)continue;
  const arrival=pieceDistance(before[from],after[to]);
  // Empty intersections have different line shapes; use the closest known background.
  const empty=emptyTiles.length?Math.min(...emptyTiles.map(t=>distance(t,after[from]))):100;
  const unexplained=diff.filter((_,i)=>i!==from&&i!==to).sort((a,b)=>b-a);
  // Last-move rings can alter the previous two intersections without changing pieces.
  if(unexplained[0]>32)continue;
  const residual=unexplained.slice(2).reduce((sum,d)=>sum+Math.max(0,d-5),0);
  const cost=arrival+empty*.65+residual*.65;
  candidates.push({move,cost,arrival,empty,residual});
 }
 candidates.sort((a,b)=>a.cost-b.cost);const best=candidates[0],gap=best&&candidates[1]?candidates[1].cost-best.cost:Infinity;
 if(!best||best.arrival>22||best.empty>22||best.residual>25||best.cost>37||gap<5)return {state:'uncertain',reason:'无法唯一匹配合法走法，请重新识别或核对局面',candidates:candidates.slice(0,3)};
 return {state:'move',move:best.move,cost:best.cost};
}
export function criticalHint(candidates,side,mySide){
 const ranked=candidates.filter(r=>!r.bound&&!r.unscored&&r.depth>=8).sort((a,b)=>a.rank-b.rank);
 const best=ranked.find(r=>r.rank===1);if(!best)return {level:'pending',text:'等待更深入的局势评估'};
 const own=side===mySide;
 if(best.scoreType==='mate')return {level:'critical',text:best.score>0?(own?'有连续将杀机会':'对方有连续将杀威胁'):(own?'面临将杀，优先寻找防守':'对方正面临将杀')};
 const mine=own?best.score:-best.score;
 const second=ranked.find(r=>r.rank===2&&r.depth>=best.depth-2);
 if(own&&second&&(second.scoreType==='mate'&&second.score<0||second.scoreType==='cp'&&best.score-second.score>=150&&best.score>-180&&second.score<-150))return {level:'critical',text:'关键回合：次选明显变差，请仔细检查推荐变化'};
 if(mine<-180)return {level:'warning',text:own?'我方处于劣势，查看最佳抵抗路线':'我方处于劣势，留意对方下一步威胁'};
 return {level:'normal',text:own?'轮到我方，推荐走法已更新':'对方思考中，持续跟踪局面'};
}
export function detectBoards({data,width:w,height:h}){
 const gray=new Uint8Array(w*h),horizontal=new Uint8Array(w*h),vertical=new Uint8Array(w*h);
 for(let i=0;i<gray.length;i++)gray[i]=(data[i*4]*.299+data[i*4+1]*.587+data[i*4+2]*.114)|0;
 for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++){const i=y*w+x;horizontal[i]=Math.max(Math.abs(gray[i]-gray[i-w*2]),Math.abs(gray[i]-gray[i+w*2]))>22?1:0;vertical[i]=Math.max(Math.abs(gray[i]-gray[i-2]),Math.abs(gray[i]-gray[i+2]))>22?1:0;}
 const segments=[],gapLimit=12;
 for(let y=3;y<h-3;y++){let start=-1,last=-1,count=0;const flush=()=>{if(start>=0&&last-start>=140&&count/(last-start+1)>.48)segments.push({x:start,right:last,y});start=-1;last=-1;count=0;};for(let x=2;x<w-2;x++){if(horizontal[y*w+x]){if(start<0)start=x;last=x;count++;}else if(start>=0&&x-last>gapLimit)flush();}flush();}
 // Collapse duplicated edges and bound work on busy screens.
 const groups=[];for(const s of segments){let group=groups.find(g=>Math.abs(g.x-s.x)<10&&Math.abs(g.right-s.right)<10);if(!group){group={x:s.x,right:s.right,rows:[]};groups.push(group);}if(!group.rows.includes(s.y))group.rows.push(s.y);}
 for(const g of groups){const clusters=[];for(const y of g.rows){const last=clusters.at(-1);if(last&&y-last.at(-1)<=7)last.push(y);else clusters.push([y]);}g.rows=clusters.map(rows=>rows.reduce((a,b)=>a+b,0)/rows.length);}
 const candidates=[];
 const coverage=(mask,x,y,length,axis)=>{let hit=0,total=0;for(let t=0;t<length;t+=2){const px=Math.round(x+(axis==='h'?t:0)),py=Math.round(y+(axis==='v'?t:0));if(px<3||px>=w-3||py<3||py>=h-3)continue;total++;let found=false;for(let d=-3;d<=3;d++)if(mask[(py+(axis==='h'?d:0))*w+px+(axis==='v'?d:0)]){found=true;break;}if(found)hit++;}return total?hit/total:0;};
 for(const g of groups.filter(g=>g.rows.length>=4).slice(0,60)){
  const dx=(g.right-g.x)/8;if(dx<18||dx>190)continue;
  for(const ratio of [.94,.97,1,1.03,1.06]){const dy=dx*ratio;
   for(const anchor of g.rows)for(let row=0;row<10;row++){
    let top=anchor-row*dy,step=dy;
    const paired=Array.from({length:10},(_,i)=>{const target=top+i*dy,nearest=g.rows.slice().sort((a,b)=>Math.abs(a-target)-Math.abs(b-target))[0];return Math.abs(nearest-target)<dy*.22?{i,y:nearest}:null;}).filter(Boolean);
    if(paired.length<4)continue;const meanI=paired.reduce((s,p)=>s+p.i,0)/paired.length,meanY=paired.reduce((s,p)=>s+p.y,0)/paired.length;const variance=paired.reduce((s,p)=>s+(p.i-meanI)**2,0);step=paired.reduce((s,p)=>s+(p.i-meanI)*(p.y-meanY),0)/variance;top=meanY-step*meanI;const bottom=top+step*9;if(top<-5||bottom>h+5||Math.abs(step/dx-1)>.1)continue;
    const matches=Array.from({length:10},(_,i)=>g.rows.some(y=>Math.abs(y-(top+i*step))<4)).filter(Boolean).length;if(matches<4)continue;
    const hs=Array.from({length:10},(_,i)=>coverage(horizontal,g.x,top+i*step,dx*8,'h'));
    const vs=Array.from({length:9},(_,i)=>coverage(vertical,g.x+i*dx,top,step*9,'v'));
    const score=hs.reduce((a,b)=>a+b,0)/10*.55+vs.reduce((a,b)=>a+b,0)/9*.45;
    if(score>.48&&hs.filter(s=>s>.65).length>=4&&vs.filter(s=>s>.25).length>=7)candidates.push({x:g.x,y:top,right:g.right,bottom,score});
   }
  }
 }
 candidates.sort((a,b)=>b.score-a.score);const unique=[];
 for(const c of candidates){if(unique.some(a=>{const overlap=Math.max(0,Math.min(a.right,c.right)-Math.max(a.x,c.x))*Math.max(0,Math.min(a.bottom,c.bottom)-Math.max(a.y,c.y));return overlap/Math.min((a.right-a.x)*(a.bottom-a.y),(c.right-c.x)*(c.bottom-c.y))>.55;}))continue;unique.push(c);if(unique.length===5)break;}
 return unique;
}
