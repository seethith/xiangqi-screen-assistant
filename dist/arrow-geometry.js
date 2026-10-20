import {splitMove,LABELS,color} from './domain.js';
export function describeMove(board,move,flip=false){
 const pair=splitMove(move);if(!pair||!board[pair[0]])return null;const [from,to]=pair,piece=board[from],a=flip?89-from:from,b=flip?89-to:to,x=a%9,y=Math.floor(a/9),tx=b%9,ty=Math.floor(b/9),directions=[];
 if(tx!==x)directions.push(`向${tx>x?'右':'左'} ${Math.abs(tx-x)} 格`);if(ty!==y)directions.push(`向${ty>y?'下':'上'} ${Math.abs(ty-y)} 格`);
 const name=(color(piece)==='w'?'红':'黑')+LABELS[piece],target=board[to];return {from,to,name,fromText:`第 ${x+1} 列 · 第 ${y+1} 行`,toText:`第 ${tx+1} 列 · 第 ${ty+1} 行`,instruction:`把${name}${directions.join('，')}。${target?`吃掉${color(target)==='w'?'红':'黑'}${LABELS[target]}。`:''}`,coordinateNote:'列从左往右、行从上往下数'};
}
export function makeArrow(move,points,width,height,flip=false,sourceId=''){
 const pair=splitMove(move);if(!pair)return null;const[a,b]=points,dx=(b.x-a.x)/8,dy=(b.y-a.y)/9,at=i=>{const n=flip?89-i:i;return[a.x+n%9*dx,a.y+Math.floor(n/9)*dy];};return {sourceId,width,height,from:at(pair[0]),to:at(pair[1]),step:Math.min(dx,dy)};
}
export function arrowMetrics(a){return {stroke:Math.max(3,a.step*.055),radius:a.step*.38,head:a.step*.21};}
export function masksPixel(x,y,a,padding=0){
 const {stroke,radius,head}=arrowMetrics(a),[fx,fy]=a.from,[tx,ty]=a.to,dx=tx-fx,dy=ty-fy,t=Math.max(0,Math.min(1,((x-fx)*dx+(y-fy)*dy)/Math.max(1,dx*dx+dy*dy))),line=Math.hypot(x-fx-t*dx,y-fy-t*dy),df=Math.hypot(x-fx,y-fy),dt=Math.hypot(x-tx,y-ty);
 return line<stroke/2+padding||Math.abs(df-radius)<stroke/2+padding||Math.abs(dt-radius)<stroke/2+padding||df<a.step*.065+padding||dt<head+padding;
}
export function maskArrowFingerprints(current,baseline,points,flip,arrow){
 if(!arrow||!baseline)return current;const [a,b]=points,dx=(b.x-a.x)/8,dy=(b.y-a.y)/9,padding=Math.max(dx,dy)*.66/20*1.2;
 return current.map((tile,index)=>{const visual=flip?89-index:index,left=a.x+visual%9*dx-dx*.33,top=a.y+Math.floor(visual/9)*dy-dy*.33,out=tile.slice();for(let y=0;y<20;y++)for(let x=0;x<20;x++)if(masksPixel(left+(x+.5)*dx*.66/20,top+(y+.5)*dy*.66/20,arrow,padding)){const p=(y*20+x)*3;for(let k=0;k<3;k++)out[p+k]=baseline[index][p+k];}return out;});
}
export function arrowMarkup(a){
 const {stroke,radius,head}=arrowMetrics(a),[fx,fy]=a.from,[tx,ty]=a.to,angle=Math.atan2(ty-fy,tx-fx),hx=tx-Math.cos(angle)*head,hy=ty-Math.sin(angle)*head,w=head*.6,triangle=`${tx},${ty} ${hx-Math.sin(angle)*w},${hy+Math.cos(angle)*w} ${hx+Math.sin(angle)*w},${hy-Math.cos(angle)*w}`;
 const v=a.viewport||{x:0,y:0,width:a.width,height:a.height};
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${a.width}" height="${a.height}" viewBox="${v.x} ${v.y} ${v.width} ${v.height}" preserveAspectRatio="none"><g fill="none" stroke="#13261a" stroke-width="${stroke+2}" opacity=".85"><circle cx="${fx}" cy="${fy}" r="${radius}"/><circle cx="${tx}" cy="${ty}" r="${radius}"/><path d="M${fx} ${fy}L${tx} ${ty}"/></g><g fill="none" stroke="#57f293" stroke-width="${stroke}" stroke-linecap="round"><circle cx="${fx}" cy="${fy}" r="${radius}"/><circle cx="${tx}" cy="${ty}" r="${radius}"/><path d="M${fx} ${fy}L${tx} ${ty}"/></g><circle cx="${fx}" cy="${fy}" r="${a.step*.065}" fill="#57f293"/><polygon points="${triangle}" fill="#57f293" stroke="#13261a" stroke-width="1"/></svg>`;
}
