// Coordinates from captured pixels are normalized before conversion to desktop DIP.
function intersects(a,b){return a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;}
function placeOverlay(workArea,board,size={width:350,height:260}){
 const pad=14,margin=18,w=Math.min(size.width,workArea.width-2*pad),h=Math.min(size.height,workArea.height-2*pad);
 const clamp=p=>({x:Math.round(Math.max(workArea.x+pad,Math.min(p.x,workArea.x+workArea.width-w-pad))),y:Math.round(Math.max(workArea.y+pad,Math.min(p.y,workArea.y+workArea.height-h-pad))),width:w,height:h});
 const proposals=board?[{x:board.x+board.width+margin,y:board.y},{x:board.x-w-margin,y:board.y},{x:board.x,y:board.y-h-margin},{x:board.x,y:board.y+board.height+margin}]:[];
 proposals.push({x:workArea.x+workArea.width-w-pad,y:workArea.y+pad},{x:workArea.x+pad,y:workArea.y+pad},{x:workArea.x+workArea.width-w-pad,y:workArea.y+workArea.height-h-pad});
 const choices=proposals.map(clamp);return choices.find(p=>!board||!intersects(p,board))||choices.at(-1);
}
function isOwnSource(source,ownIds){return source.id.startsWith('window:')&&ownIds.some(id=>id.split(':')[1]===source.id.split(':')[1]);}
module.exports={placeOverlay,intersects,isOwnSource};

function sanitizeArrow(value,sourceId){if(!value||value.sourceId!==sourceId||!sourceId?.startsWith('screen:'))return null;if(!Number.isFinite(value.width)||!Number.isFinite(value.height)||value.width<1||value.height<1||value.width>16384||value.height>16384||!Number.isFinite(value.step)||value.step<3||value.step>Math.max(value.width,value.height))return null;for(const point of [value.from,value.to])if(!Array.isArray(point)||point.length!==2||!point.every(Number.isFinite)||point[0]<0||point[1]<0||point[0]>value.width||point[1]>value.height)return null;return {sourceId,width:value.width,height:value.height,step:value.step,from:value.from.slice(),to:value.to.slice()};}
module.exports.sanitizeArrow=sanitizeArrow;

function sourceViewport(display,bounds,width,height){const sx=display.width/width,sy=display.height/height;return {x:(bounds.x-display.x)/sx,y:(bounds.y-display.y)/sy,width:bounds.width/sx,height:bounds.height/sy};}
module.exports.sourceViewport=sourceViewport;

const MINI_DEFAULT={width:360,height:320};
const MINI_LIMITS={minWidth:300,minHeight:260,maxWidth:600,maxHeight:680};
// Desktop coordinates are DIP, including Retina and displays left of the primary.
function constrainMini(bounds,area){
 const width=Math.round(Math.min(area.width,Math.max(MINI_LIMITS.minWidth,Math.min(MINI_LIMITS.maxWidth,bounds.width))));
 const height=Math.round(Math.min(area.height,Math.max(MINI_LIMITS.minHeight,Math.min(MINI_LIMITS.maxHeight,bounds.height))));
 return {x:Math.round(Math.max(area.x,Math.min(bounds.x,area.x+area.width-width))),y:Math.round(Math.max(area.y,Math.min(bounds.y,area.y+area.height-height))),width,height};
}
function gestureBounds(start,origin,cursor,mode,area){
 const dx=cursor.x-origin.x,dy=cursor.y-origin.y;
 return constrainMini(mode==='move'?{...start,x:start.x+dx,y:start.y+dy}:{...start,width:Math.min(start.width+dx,area.x+area.width-start.x),height:Math.min(start.height+dy,area.y+area.height-start.y)},area);
}
module.exports.MINI_DEFAULT=MINI_DEFAULT;
module.exports.MINI_LIMITS=MINI_LIMITS;
module.exports.constrainMini=constrainMini;
module.exports.gestureBounds=gestureBounds;
