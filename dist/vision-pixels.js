// Piece-local segmentation: never use the surrounding wooden board to decide a side.
export const glyphs={帅:'k',帥:'k',将:'k',將:'k',仕:'a',士:'a',相:'b',象:'b',兵:'p',卒:'p',车:'r',車:'r',俥:'r',马:'n',馬:'n',傌:'n',炮:'c',砲:'c'};
export const glyphSides={帅:'w',帥:'w',将:'b',將:'b',仕:'w',士:'b',相:'w',象:'b',兵:'w',卒:'b',俥:'w',傌:'w'};
const median=values=>{values.sort((a,b)=>a-b);return values[Math.floor(values.length/2)]||0;};
const rgbMedian=values=>[0,1,2].map(k=>median(values.map(v=>v[k])));
const gray=v=>v[0]*.299+v[1]*.587+v[2]*.114;
const distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
function otsu(values){const h=Array(256).fill(0);for(const v of values)h[Math.round(v)]++;let sum=0;h.forEach((n,i)=>sum+=n*i);let left=0,leftSum=0,best=-1,threshold=0;for(let i=0;i<255;i++){left+=h[i];leftSum+=h[i]*i;if(!left||left===values.length)continue;const d=leftSum/left-(sum-leftSum)/(values.length-left),score=left*(values.length-left)*d*d;if(score>best){best=score;threshold=i;}}return threshold;}
export function segmentPiece({data,width,height},{minContrast=32,inkRadius=.405}={}){
 const size=Math.min(width,height),cx=(width-1)/2,cy=(height-1)/2,inner=[],ring=[],outside=[];
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const radius=Math.hypot(x-cx,y-cy)/size,p=(y*width+x)*4,v=[data[p],data[p+1],data[p+2]];if(radius<inkRadius)inner.push({i:y*width+x,v,l:gray(v)});if(radius>.32&&radius<.39)ring.push(v);if(radius>.56)outside.push(v);}
 const body=rgbMedian(ring),bodyLight=gray(body),threshold=otsu(inner.map(p=>p.l))+.5;
 // A light glyph on a dark disc must be inverted before OCR.
 const lightInk=bodyLight<threshold,mask=new Uint8Array(width*height),foreground=[],background=[];
 const cutoff=lightInk?Math.max(threshold,bodyLight+minContrast):Math.min(threshold,bodyLight-minContrast);
 for(const p of inner){const ink=lightInk?p.l>cutoff:p.l<cutoff;mask[p.i]=ink?1:0;(ink?foreground:background).push(p.v);}
 const letter=foreground.length?rgbMedian(foreground):body,fill=background.length?rgbMedian(background):body;
 let x0=width,x1=-1,y0=height,y1=-1,count=0;
 for(let i=0;i<mask.length;i++)if(mask[i]){const x=i%width,y=Math.floor(i/width);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);count++;}
 const fillRatio=count/Math.max(1,(x1-x0+1)*(y1-y0+1));
 // Long, thin grid/border lines are not character strokes. Measure the residual
 // only for flat skins; leave real disc glyphs intact.
 const usable=mask.slice();
 for(const axis of [0,1]){const lines=[];for(let a=0;a<size;a++){let run=0,best=0;for(let b=0;b<size;b++){const i=axis?a*width+b:b*width+a;run=mask[i]?run+1:0;best=Math.max(best,run);}if(best>size*.72)lines.push(a);}if(lines.length<size*.12)for(const a of lines)for(let b=0;b<size;b++)usable[axis?a*width+b:b*width+a]=0;}
 const usableCount=usable.reduce((a,b)=>a+b,0);
 const fraction=count/(size*size),contrast=distance(letter,fill);
 const discContrast=distance(fill,rgbMedian(outside));
 const occupied=fraction>.025&&fraction<.38&&x1-x0>size*.22&&y1-y0>size*.27&&(discContrast>14||usableCount>size*size*.075)&&contrast>48&&fillRatio<.68;
 const feature=lightInk?fill:letter,redness=feature[0]-Math.max(feature[1],feature[2]);
 const side=redness>24&&feature[0]>feature[1]*1.45&&(feature[1]-feature[2])/Math.max(1,feature[0]-feature[2])<.25?'w':'b';
 const sideConfidence=side==='w'?Math.min(95,55+redness*.45):Math.min(95,55+Math.max(0,24-redness)*1.4);
 return {mask,width,height,occupied,feature,lightInk,body:fill,letter,side,sideConfidence,fraction,contrast,discContrast,bounds:[x0,y0,x1,y1]};
}
export function classifySide(piece,anchors){
 const red=anchors.w,black=anchors.b;
 if(red&&black){if(distance(red,black)<=40)return {side:piece.side,confidence:40};const dr=distance(piece.feature,red),db=distance(piece.feature,black),gap=Math.abs(dr-db),separation=distance(red,black);if(separation>40&&Math.min(dr,db)<separation*.75)return {side:dr<db?'w':'b',confidence:Math.min(98,50+gap/separation*48)};}
 for(const side of ['w','b'])if(anchors[side]&&distance(piece.feature,anchors[side])<30)return {side,confidence:90};
 return {side:piece.side,confidence:piece.sideConfidence};
}
export function sideAnchors(results){const anchors={};for(const side of ['w','b']){const known=results.filter(r=>r&&(r.learnedSide||(!r.learned&&glyphSides[r.glyph]))===side&&r.certainty>=70).map(r=>r.piece.feature);if(known.length)anchors[side]=rgbMedian(known);}return anchors;}
