import {circleEvidence,rememberPieces,matchSamples,clearLearnedPieces} from './vision-learning.js';
import {glyphs as aliases,glyphSides,segmentPiece,classifySide,sideAnchors} from './vision-pixels.js';
let scriptPromise=null;
function loadOCR(){if(window.Tesseract)return Promise.resolve(window.Tesseract);if(!scriptPromise)scriptPromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='/ocr/tesseract.min.js';s.onload=()=>resolve(window.Tesseract);s.onerror=()=>{scriptPromise=null;s.remove();reject(Error('识别组件下载失败，请检查网络后重试。'));};document.head.append(s);});return scriptPromise;}
function tileAt(image,points,i,scale=.72,minContrast=32,inkRadius=.405){
 const [a,b]=points,dx=(b.x-a.x)/8,dy=(b.y-a.y)/9,raw=document.createElement('canvas');raw.width=raw.height=96;const c=raw.getContext('2d',{willReadFrequently:true});c.fillStyle='white';c.fillRect(0,0,96,96);c.drawImage(image,a.x+i%9*dx-dx*scale/2,a.y+Math.floor(i/9)*dy-dy*scale/2,dx*scale,dy*scale,0,0,96,96);const piece=segmentPiece(c.getImageData(0,0,96,96),{minContrast,inkRadius}),tile=document.createElement('canvas');tile.width=tile.height=96;const out=tile.getContext('2d',{willReadFrequently:true}),pixels=out.createImageData(96,96);for(let j=0;j<piece.mask.length;j++){pixels.data[j*4]=pixels.data[j*4+1]=pixels.data[j*4+2]=piece.mask[j]?0:255;pixels.data[j*4+3]=255;}out.putImageData(pixels,0,0);return {tile,piece,raw};
}
export function prepareBoard(image,points){
 const [a,b]=points,dx=(b.x-a.x)/8,dy=(b.y-a.y)/9,tiles=[],pieces=[];
 for(let i=0;i<90;i++){
  const {piece,tile}=tileAt(image,points,i);const wide=tileAt(image,points,i,.94);piece.circle=circleEvidence(wide.raw.getContext('2d',{willReadFrequently:true}).getImageData(0,0,96,96));piece.candidate=piece.occupied||piece.circle>24;pieces.push(piece);tiles.push(tile);

 }return {tiles,pieces};
}
// 字形模板补充通用 OCR，尤其用于截图中尺寸较小的单字。
function shape(tile){const c=tile.getContext('2d',{willReadFrequently:true}),{data,width,height}=c.getImageData(0,0,tile.width,tile.height);const ink=new Uint8Array(width*height);for(let i=0;i<ink.length;i++)ink[i]=data[i*4]<150?1:0;
 const visited=new Uint8Array(ink.length);for(let i=0;i<ink.length;i++){if(!ink[i]||visited[i])continue;const stack=[i],component=[];visited[i]=1;let sx=0,sy=0;while(stack.length){const j=stack.pop(),x=j%width,y=Math.floor(j/width);component.push(j);sx+=x;sy+=y;for(const k of [j-1,j+1,j-width,j+width])if(k>=0&&k<ink.length&&Math.abs(k%width-x)<=1&&ink[k]&&!visited[k]){visited[k]=1;stack.push(k);}}if(component.length<5||Math.hypot(sx/component.length-width/2,sy/component.length-height/2)>width*.44)for(const j of component)ink[j]=0;}
 let x0=width,x1=-1,y0=height,y1=-1;for(let i=0;i<ink.length;i++)if(ink[i]){const x=i%width,y=Math.floor(i/width);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}if(x1<0)return null;const normalized=new Uint8Array(1024);for(let y=0;y<32;y++)for(let x=0;x<32;x++)normalized[y*32+x]=ink[Math.min(height-1,Math.round(y0+y*(y1-y0)/31))*width+Math.min(width-1,Math.round(x0+x*(x1-x0)/31))];return normalized;
}
let templates=null;
export function templateGuess(tile){if(!templates){templates=[];for(const font of ['XQ Recognition','Songti SC','SimSun','Kaiti SC','STKaiti','KaiTi','PingFang SC','Microsoft YaHei','serif'])for(const weight of ['normal','bold'])for(const glyph of Object.keys(aliases)){const t=document.createElement('canvas');t.width=t.height=80;const c=t.getContext('2d');c.fillStyle='white';c.fillRect(0,0,80,80);c.fillStyle='black';c.font=`${weight} 54px "${font}"`;c.textAlign='center';c.textBaseline='middle';c.fillText(glyph,40,43);templates.push({glyph,shape:shape(t)});}}
 const target=shape(tile);if(!target)return null;const scores={};for(const t of templates){if(!t.shape)continue;let intersect=0,sum=0;for(let i=0;i<1024;i++){sum+=target[i]+t.shape[i];intersect+=target[i]&&t.shape[i]?1:0;}const score=sum?2*intersect/sum:0;scores[t.glyph]=Math.max(scores[t.glyph]||0,score);}const ranked=Object.entries(scores).sort((a,b)=>b[1]-a[1]);return{glyph:ranked[0][0],score:ranked[0][1],margin:ranked[0][1]-(ranked.find(r=>aliases[r[0]]!==aliases[ranked[0][0]])?.[1]||0)};}

function enlargedGlyph(tile,piece){const [x0,y0,x1,y1]=piece.bounds,canvas=document.createElement('canvas');canvas.width=canvas.height=160;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,160,160);const scale=124/Math.max(x1-x0+1,y1-y0+1),w=(x1-x0+1)*scale,h=(y1-y0+1)*scale;ctx.drawImage(tile,x0,y0,x1-x0+1,y1-y0+1,(160-w)/2,(160-h)/2,w,h);return canvas;}
let fontBoot=null;
async function loadTemplatesFont(){if(!fontBoot)fontBoot=(async()=>{const font=new FontFace('XQ Recognition',"url('/ocr/xq-recognition.woff')");await font.load();document.fonts.add(font);})().catch(e=>{fontBoot=null;throw Error('本地字形模板加载失败：'+e.message);});return fontBoot;}
let persistentWorker=null,workerBoot=null;
async function getWorker(){
 if(persistentWorker)return persistentWorker;if(workerBoot)return workerBoot;
 workerBoot=(async()=>{await loadTemplatesFont();const T=await loadOCR();const worker=await T.createWorker(['chi_sim','chi_tra'],1,{workerPath:'/ocr/worker.min.js',corePath:'/ocr/core',langPath:'/ocr/lang',workerBlobURL:false});await worker.setParameters({tessedit_pageseg_mode:'10',tessedit_char_whitelist:Object.keys(aliases).join(''),user_defined_dpi:'150'});persistentWorker=worker;return worker;})().finally(()=>workerBoot=null);return workerBoot;
}
export async function releaseRecognition(){if(workerBoot)await workerBoot.catch(()=>{});const w=persistentWorker;persistentWorker=null;await w?.terminate();}
export {clearLearnedPieces};
export function learnBoard(source,points,board,{flip=false}={}){
 const prepared=prepareBoard(source,points),items=[];for(let i=0;i<90;i++){const p=board[flip?89-i:i];if(!p||!prepared.pieces[i].candidate)continue;for(const [scale,contrast,radius] of [[.72,32,.405],[.72,12,.405],[.9,12,.405],[.56,12,.44]]){const view=tileAt(source,points,i,scale,contrast,radius),piece=view.piece,target=shape(view.tile);if(target&&piece.fraction>.005&&piece.fraction<.38)items.push({role:p.toLowerCase(),side:p===p.toUpperCase()?'w':'b',shape:target,feature:piece.feature});}}return rememberPieces(items);
}
async function readTile(worker,tile,piece){const guess=templateGuess(tile),sample=matchSamples({shape:shape(tile),feature:piece.feature});if(sample?.score>.92&&sample.margin>.07)return {glyph:Object.keys(aliases).find(g=>aliases[g]===sample.role),certainty:96,piece,tile,shape:shape(tile),learned:true,learnedSide:sample.side};
 const {data}=await worker.recognize(tile,{tessedit_pageseg_mode:'10'},{text:true});let glyph=[...(data.text||'')].find(t=>aliases[t]),certainty=data.confidence||0;
 if(!glyph||certainty<70){const retry=await worker.recognize(enlargedGlyph(tile,piece),{tessedit_pageseg_mode:'13'},{text:true}),alternative=[...(retry.data.text||'')].find(t=>aliases[t]);if(alternative&&(!glyph||retry.data.confidence>certainty)){glyph=alternative;certainty=retry.data.confidence||0;}}
 if(guess&&((!glyph&&((guess.score>.64&&guess.margin>.01)||(guess.score>.60&&guess.margin>.06)))||(guess.score>.88&&guess.margin>.07&&certainty<75))){glyph=guess.glyph;certainty=Math.min(guess.margin<.03?64:95,guess.score*100);}
 if(glyph&&guess&&aliases[glyph]===aliases[guess.glyph]&&guess.score>.72)certainty=Math.max(certainty,Math.min(90,guess.score*100));
 return {glyph,certainty,piece,tile,shape:shape(tile)};
}
export async function recognizeBoard(source,points,{flip=false,onProgress=()=>{},isCancelled=()=>false}={}){
 onProgress('检测棋子轮廓，准备本地识别…');const worker=await getWorker(),tiles=prepareBoard(source,points),board=Array(90).fill(null),confidence=Array(90).fill(-1),missing=[],results=Array(90).fill(null),sideUncertain=[],indices=tiles.pieces.map((p,i)=>p.candidate?i:-1).filter(i=>i>=0);
 for(let n=0;n<indices.length;n++){
  if(isCancelled())throw Error('识别已取消');const i=indices[n];onProgress(`辨认棋子 ${n+1} / ${indices.length}`);let result=await readTile(worker,tiles.tiles[i],tiles.pieces[i]);
  if(!result.glyph||result.certainty<65){const readings=[result];for(const [scale,contrast,radius] of [[.72,12,.405],[.9,18,.405],[.56,12,.44]]){if(isCancelled())throw Error('识别已取消');const view=tileAt(source,points,i,scale,contrast,radius);if(view.piece.fraction<.016||view.piece.fraction>.4)continue;readings.push(await readTile(worker,view.tile,view.piece));}
   const ranked=readings.filter(r=>r.glyph).sort((a,b)=>b.certainty-a.certainty);if(ranked.length){const best=ranked[0],agree=ranked.filter(r=>aliases[r.glyph]===aliases[best.glyph]).length;result={...best,certainty:agree>=2?Math.min(95,best.certainty+(best.certainty>=60?5:0)):Math.min(best.certainty,64)};}
  }
  results[i]=result;
 }
 // A confidently read twin is a font reference from this actual game, rather
 // than a system-font approximation. Rescue only a separated, strong match.
 const refs=results.filter(r=>r?.glyph&&r.certainty>=75&&r.shape).map(r=>({role:aliases[r.glyph],shape:r.shape,feature:r.piece.feature,side:r.learnedSide||(!r.learned&&glyphSides[r.glyph])||r.piece.side}));
 for(const i of indices){const r=results[i];if(r.glyph&&r.certainty>=65)continue;const match=matchSamples({shape:r.shape,feature:r.piece.feature},refs);if(match?.score>.88&&match.margin>.07){r.glyph=Object.keys(aliases).find(g=>aliases[g]===match.role);r.certainty=84;r.learnedSide=match.side;}}
 const anchors=sideAnchors(results);
 for(const i of indices){const r=results[i],target=flip?89-i:i;if(!r.glyph){missing.push(target);continue;}const {glyph,certainty,piece}=r,side=r.learnedSide?{side:r.learnedSide,confidence:96}:classifySide(piece,anchors);let colorCertainty=side.confidence;if(!r.learned&&!r.learnedSide&&glyphSides[glyph]&&glyphSides[glyph]!==side.side)colorCertainty=Math.min(colorCertainty,45);if(colorCertainty<65)sideUncertain.push(target);board[target]=side.side==='w'?aliases[glyph].toUpperCase():aliases[glyph];confidence[target]=Math.min(certainty,colorCertainty);}
 return {board,confidence,missing,sideUncertain,candidates:indices.map(i=>flip?89-i:i),uncertain:confidence.map((v,i)=>v>=0&&v<65?i:-1).filter(i=>i>=0)};
}
export function fingerprints(source,points,flip=false){
 const [a,b]=points,dx=(b.x-a.x)/8,dy=(b.y-a.y)/9,result=[];const tile=document.createElement('canvas');tile.width=tile.height=20;const c=tile.getContext('2d',{willReadFrequently:true});
 for(let i=0;i<90;i++){c.clearRect(0,0,20,20);c.drawImage(source,a.x+i%9*dx-dx*.33,a.y+Math.floor(i/9)*dy-dy*.33,dx*.66,dy*.66,0,0,20,20);const pixels=c.getImageData(0,0,20,20).data,descriptor=[];for(let j=0;j<pixels.length;j+=4)descriptor.push(pixels[j],pixels[j+1],pixels[j+2]);result[flip?89-i:i]=descriptor;}return result;
}
