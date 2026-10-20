import {writeFen,readFen,opposite,chineseMove} from './domain.js';
const equal=(a,b)=>a.every((p,i)=>p===b[i]);
// Use the existing Fairy-Stockfish rule library to reconcile a model observation.
// Supports one missed reply without guessing; rejects ambiguity and larger gaps.
export function matchRecognizedMoves(rules,position,result,maxNodes=6000){
 const before=position.board,target=result.board;
 if(result.missing.length||result.uncertain.some(i=>before[i]!==target[i]))return {state:'uncertain',reason:'变化位置的识别置信度不足，等候下一帧'};
 if(equal(before,target))return {state:'unchanged',moves:[]};
 if(before.filter((p,i)=>p!==target[i]).length>4)return {state:'uncertain',reason:'局面变化过大，需重新核对'};
 const targetFen=writeFen(target).split(' ')[0];let nodes=0,overLimit=false;
 function search(side,plies){
  const board=new rules.Board('xiangqi',writeFen(before,side)),found=[];
  const legal=()=>board.legalMoves().trim().split(/\s+/).filter(Boolean),same=()=>board.fen().split(' ')[0]===targetFen;
  try{
   for(const move of legal()){
    board.push(move);
    if(plies===1){if(same())found.push([move]);}
    else for(const reply of legal()){
     if(++nodes>maxNodes){overLimit=true;break;}
     board.push(reply);if(same())found.push([move,reply]);board.pop();
    }
    board.pop();if(overLimit||found.length>1)break;
   }
   return found;
  }finally{board.delete();}
 }
 const matched=(moves,startSide)=>({state:'move',moves,startSide,nextSide:moves.length%2?opposite(startSide):startSide,correctedTurn:startSide!==position.side,fromFen:writeFen(before,position.side),placement:targetFen});
 // A unique observed single move identifies its mover even if the initial turn
 // was entered incorrectly. A static image never supplies that information.
 for(const side of [position.side,opposite(position.side)]){
  const found=search(side,1);
  if(found.length===1)return matched(found[0],side);
  if(found.length>1)return {state:'uncertain',reason:'走棋顺序不唯一，请重新核对'};
 }
 const found=search(position.side,2);
 return found.length===1&&!overLimit?matched(found[0],position.side):{state:'uncertain',reason:overLimit?'同步搜索达到上限，请重新核对':found.length?'走棋顺序不唯一，请重新核对':'画面无法对应一至两步合法走法'};
}

// Prepare the complete new game before committing it to the UI. Correcting a
// stale turn resets incompatible history; normal tracking retains all history.
export function reconcileTrackedPosition(rules,position,match){
 if(match.state!=='move'||match.fromFen!==writeFen(position.board,position.side))throw Error('局面已变化，重新读取后再同步');
 const corrected=match.startSide!==position.side;
 const next={...position,board:position.board.slice(),baseFen:corrected?writeFen(position.board,match.startSide):position.baseFen||writeFen(position.board,position.side),moves:corrected?[]:[...(position.moves||[])],names:corrected?[]:[...(position.names||[])]};
 const board=new rules.Board('xiangqi',next.baseFen);
 try{
  for(const move of next.moves)if(!board.push(move))throw Error('走棋记录不一致，请核对局面');
  for(const move of match.moves){
   const text=chineseMove(readFen(board.fen()).board,move);
   if(!board.push(move))throw Error('识别到的走法不合法');
   next.moves.push(move);next.names.push(text);
  }
  const actual=readFen(board.fen());
  if(actual.side!==match.nextSide||board.fen().split(' ')[0]!==match.placement)throw Error('同步结果与画面不一致');
  return {...next,...actual};
 }finally{board.delete();}
}

export function createObservationGate(){
 let key='',stamp=null;
 return {
  reset(){key='';stamp=null;},
  observe(match,frameStamp){
   if(match.state!=='move'){this.reset();return match;}
   const next=JSON.stringify([match.fromFen,match.placement,match.startSide,match.moves]);
   if(key===next&&stamp!==frameStamp){this.reset();return match;}
   key=next;stamp=frameStamp;
   return {state:'pending',reason:'已发现走子，正在用下一帧确认行棋方'};
  }
 };
}

// Fingerprint masking and low-contrast skins can hide changes. Always revisit
// the actual piece identities, including while an old arrow is on screen.
export const semanticProbeDue=(now,last)=>now-last>=1500;
