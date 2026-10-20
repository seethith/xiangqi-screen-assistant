// Adapter for the pretrained models published by TheOne / yolo12138.
// Preprocessing follows Chinese_Chess_Recognition/core/runonnx and helper_4_kpt.
// The upstream Space declares MIT. See desktop/models/manifest.json for pinned sources.
// Modified 2026-10-20: JS/IPC adapter, confidence checks, local-only inference; original MIT notice in licenses/recognition-models-mit.txt.
const MEAN=[123.675,116.28,103.53],STD=[58.395,57.12,57.375];
const LABELS=['.','x','K','A','B','N','R','C','P','k','a','b','n','r','c','p'];
export const modelAvailable=()=>Boolean(globalThis.desktopAPI?.modelInfer);
const infer=(kind,input)=>globalThis.desktopAPI.modelInfer(kind,input);
export function rectangleCorners(points,flip=false){const [a,b]=points,k=[a,{x:b.x,y:a.y},{x:a.x,y:b.y},b].map(p=>({...p}));return flip?k.reverse():k;}
export function decodeLayout(output){
 if(!output||output.data?.length!==90*16)throw Error('模型返回的局面尺寸无效');
 const board=Array(90).fill(null),confidence=[],uncertain=[],missing=[],sideUncertain=[];
 for(let i=0;i<90;i++){
  let p=output.data.slice(i*16,i*16+16);if(!p.every(Number.isFinite))throw Error('模型返回的局面数值无效');
  const sum=p.reduce((a,b)=>a+b,0);if(p.some(v=>v<0)||Math.abs(sum-1)>.01){const max=Math.max(...p);p=p.map(v=>Math.exp(v-max));const s=p.reduce((a,b)=>a+b,0);p=p.map(v=>v/s);}
  const ranked=p.map((v,j)=>({v,j})).sort((a,b)=>b.v-a.v),first=ranked[0],label=LABELS[first.j];confidence[i]=first.v*100;
  if(label==='x'){missing.push(i);uncertain.push(i);}else if(label!=='.')board[i]=label;
  if(first.v<.8||first.v-ranked[1].v<.3){if(!uncertain.includes(i))uncertain.push(i);}
  if(board[i]){const opposite=LABELS.indexOf(label===label.toUpperCase()?label.toLowerCase():label.toUpperCase());if(first.v-p[opposite]<.3)sideUncertain.push(i);}
 }
 return {board,confidence,uncertain,missing,sideUncertain,method:'pretrained',canLearn:false};
}
export function plausibleBoard(result){
 const b=result.board,limits={K:1,A:2,B:2,N:2,R:2,C:2,P:5,k:1,a:2,b:2,n:2,r:2,c:2,p:5},counts={};for(const p of b)if(p)counts[p]=(counts[p]||0)+1;
 if(counts.K!==1||counts.k!==1||Object.entries(counts).some(([p,n])=>n>limits[p])||result.missing.length>3)return false;
 for(const p of ['K','k']){const i=b.indexOf(p),x=i%9,y=Math.floor(i/9);if(x<3||x>5||(p==='K'?y<7:y>2))return false;}
 return b.reduce((sum,p,i)=>sum+(p?result.confidence[i]:0),0)/b.filter(Boolean).length>=75;
}
export function projectiveMap(from,to){
 const m=[];for(let i=0;i<4;i++){const{x:u,y:v}=from[i],{x,y}=to[i];m.push([u,v,1,0,0,0,-x*u,-x*v,x],[0,0,0,u,v,1,-y*u,-y*v,y]);}
 for(let c=0;c<8;c++){let pivot=c;for(let r=c+1;r<8;r++)if(Math.abs(m[r][c])>Math.abs(m[pivot][c]))pivot=r;if(Math.abs(m[pivot][c])<1e-10)throw Error('棋盘角点重合，请重新标记');[m[c],m[pivot]]=[m[pivot],m[c]];const d=m[c][c];for(let j=c;j<9;j++)m[c][j]/=d;for(let r=0;r<8;r++)if(r!==c){const f=m[r][c];for(let j=c;j<9;j++)m[r][j]-=f*m[c][j];}}
 const a=m.map(r=>r[8]);return (u,v)=>{const w=a[6]*u+a[7]*v+1;return{x:(a[0]*u+a[1]*v+a[2])/w,y:(a[3]*u+a[4]*v+a[5])/w};};
}
function sourcePixels(source){if(source.getContext)return source.getContext('2d',{willReadFrequently:true}).getImageData(0,0,source.width,source.height);const c=document.createElement('canvas');c.width=source.naturalWidth||source.width;c.height=source.naturalHeight||source.height;c.getContext('2d').drawImage(source,0,0);return c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,c.width,c.height);}
export function layoutTensor(image,corners){
 const W=280,H=315,n=W*H,out=new Float32Array(n*3),target=[{x:17.5,y:17.5},{x:262.5,y:17.5},{x:17.5,y:297.5},{x:262.5,y:297.5}],map=projectiveMap(target,corners),{data,width,height}=image;
 // Match the upstream 450x500 warp, centre crop to 400x450, then resize.
 // Direct inverse mapping avoids a second full-size screenshot buffer.
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const p=map(x+.5,y+.5),px=p.x-.5,py=p.y-.5,ix=Math.floor(px),iy=Math.floor(py),fx=px-ix,fy=py-iy;for(let c=0;c<3;c++){let value=0;for(let j=0;j<2;j++)for(let k=0;k<2;k++){const xx=ix+k,yy=iy+j;if(xx>=0&&xx<width&&yy>=0&&yy<height)value+=data[(yy*width+xx)*4+c]*(k?fx:1-fx)*(j?fy:1-fy);}out[c*n+y*W+x]=(value-MEAN[c])/STD[c];}}
 return out;
}
export function poseTensor(image){
 const {data,width,height}=image,side=Math.max(width,height)*1.25,input=new Float32Array(3*256*256),left=width/2-side/2,top=height/2-side/2;
 // OpenCV warpAffine samples the source directly with bilinear interpolation.
 // Canvas downscaling adds area filtering, which changes the small-grid signal.
 for(let y=0;y<256;y++)for(let x=0;x<256;x++){const px=left+x/256*side,py=top+y/256*side,ix=Math.floor(px),iy=Math.floor(py),fx=Math.round((px-ix)*32)/32,fy=Math.round((py-iy)*32)/32;for(let c=0;c<3;c++){let v=0;for(let j=0;j<2;j++)for(let k=0;k<2;k++){const xx=ix+k,yy=iy+j;if(xx>=0&&xx<width&&yy>=0&&yy<height)v+=data[(yy*width+xx)*4+c]*(k?fx:1-fx)*(j?fy:1-fy);}input[c*65536+y*256+x]=(Math.round(v)-MEAN[c])/STD[c];}}
 return input;
}
async function poseCorners(source){
 const pixels=sourcePixels(source),{width,height}=pixels,side=Math.max(width,height)*1.25,input=poseTensor(pixels);
 const outputs=await infer('pose',input);if(outputs.length!==2||outputs.some(o=>o.data.length!==4*512))throw Error('棋盘定位模型输出无效');
 const argmax=(a,start)=>{let j=0;for(let i=1;i<512;i++)if(a[start+i]>a[start+j])j=i;return j;};
 return Array.from({length:4},(_,i)=>({x:width/2-side/2+argmax(outputs[0].data,i*512)/512*side,y:height/2-side/2+argmax(outputs[1].data,i*512)/512*side}));
}
export async function recognizeModelBoard(source,points,{flip=false,corners=null,onProgress=()=>{},isCancelled=()=>false}={}){
 onProgress('专用模型正在本机识别整个棋盘…');if(isCancelled())throw Error('识别已取消');
 const k=corners?(flip?[...corners].reverse():corners):rectangleCorners(points,flip),input=layoutTensor(sourcePixels(source),k),outputs=await infer('layout',input);if(isCancelled())throw Error('识别已取消');return {...decodeLayout(outputs[0]),corners:k};
}
export async function detectModelBoards(source){
 const k=await poseCorners(source),width=source.naturalWidth||source.width,height=source.naturalHeight||source.height;if(k.some(p=>!Number.isFinite(p.x+p.y)||p.x<0||p.y<0||p.x>width||p.y>height))return [];
 const flip=k[0].y+k[1].y>k[2].y+k[3].y,visual=flip?[...k].reverse():k,[tl,tr,bl,br]=visual,x=(tl.x+bl.x)/2,right=(tr.x+br.x)/2,y=(tl.y+tr.y)/2,bottom=(bl.y+br.y)/2,dx=(right-x)/8,dy=(bottom-y)/9;
 if(dx<12||dy<12||dx/dy<.65||dx/dy>1.5||tl.x>=tr.x||bl.x>=br.x||tl.y>=bl.y||tr.y>=br.y)return [];
 const result=await recognizeModelBoard(source,[tl,br],{flip,corners:visual});if(!plausibleBoard(result))return [];
 return [{x,y,right,bottom,score:result.confidence.reduce((a,b)=>a+b,0)/9000,corners:visual,flip,model:true}];
}
