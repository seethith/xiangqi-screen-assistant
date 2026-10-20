const KEY='xq-piece-samples-v1';
let samples=null;
export function dice(a,b){if(!a||!b)return 0;let sum=0,intersection=0;for(let i=0;i<1024;i++){sum+=a[i]+b[i];intersection+=a[i]&&b[i]?1:0;}return sum?intersection*2/sum:0;}
const featureDistance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
function pack(shape){const bytes=new Uint8Array(128);for(let i=0;i<1024;i++)if(shape[i])bytes[i>>3]|=1<<(i%8);return btoa(String.fromCharCode(...bytes));}
function unpack(text){const bytes=atob(text);if(bytes.length!==128)throw Error('样式数据无效');return Uint8Array.from({length:1024},(_,i)=>(bytes.charCodeAt(i>>3)>>(i%8))&1);}
function load(){if(samples)return samples;samples=[];try{const saved=JSON.parse(localStorage.getItem(KEY)||'[]');if(!Array.isArray(saved))return samples;for(const s of saved.slice(-512))if('kabnrcp'.includes(s.role)&&s.role.length===1&&['w','b'].includes(s.side)&&Array.isArray(s.feature)&&s.feature.length===3&&s.feature.every(v=>Number.isFinite(v)&&v>=0&&v<=255)&&typeof s.bits==='string')samples.push({...s,shape:unpack(s.bits)});}catch{}return samples;}
export function clearLearnedPieces(){samples=[];localStorage.removeItem(KEY);}
export function rememberPieces(items){const all=load();let learned=0;for(const item of items){if(!item.shape)continue;const match=all.find(s=>s.role===item.role&&s.side===item.side&&featureDistance(s.feature,item.feature)<30&&dice(s.shape,item.shape)>.96);if(match)continue;all.push({...item,bits:pack(item.shape)});learned++;}samples=all.slice(-512);localStorage.setItem(KEY,JSON.stringify(samples.map(({shape,...s})=>s)));return learned;}
export function matchSamples(target,items=load()){
 if(!target.shape)return null;const ranks=items.map(s=>({...s,score:dice(target.shape,s.shape),distance:featureDistance(target.feature,s.feature)})).sort((a,b)=>b.score-a.score);if(!ranks.length)return null;const first=ranks[0],other=ranks.find(s=>s.role!==first.role),margin=first.score-(other?.score||0),same=ranks.filter(s=>s.role===first.role&&s.score>first.score-.035).sort((a,b)=>a.distance-b.distance),nearest=same[0],opponent=same.find(s=>s.side!==nearest.side);
 return {role:first.role,score:first.score,margin,side:nearest.distance<30&&(!opponent||opponent.distance-nearest.distance>25)?nearest.side:null};
}
export function circleEvidence({data,width,height}){
 const cx=(width-1)/2,cy=(height-1)/2,size=Math.min(width,height),read=(x,y)=>{const i=(Math.max(0,Math.min(height-1,Math.round(y)))*width+Math.max(0,Math.min(width-1,Math.round(x))))*4;return [data[i],data[i+1],data[i+2]];};let best=0;
 // Sample the circular boundary away from orthogonal grid lines. A tiny
 // last-move dot has a smaller radius and is not a piece candidate.
 for(let r=size*.24;r<size*.48;r+=1.5){const contrasts=[];for(let k=0;k<24;k++){const angle=(k+.5)/24*Math.PI*2,x=Math.cos(angle),y=Math.sin(angle);const a=read(cx+x*(r-2.5),cy+y*(r-2.5)),b=read(cx+x*(r+2.5),cy+y*(r+2.5));contrasts.push(featureDistance(a,b));}contrasts.sort((a,b)=>a-b);const coherent=contrasts.filter(v=>v>24).length/24,score=contrasts[7];if(coherent>=.7)best=Math.max(best,score);}
 return best;
}
