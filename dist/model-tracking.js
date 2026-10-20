import {writeFen} from './domain.js';
const equal=(a,b)=>a.every((p,i)=>p===b[i]);
// Use the existing Fairy-Stockfish rule library to reconcile a model observation.
// Supports one missed reply without guessing; rejects ambiguity and larger gaps.
export function matchRecognizedMoves(rules,position,result,maxNodes=6000){
 const before=position.board,target=result.board;
 if(result.missing.length||result.uncertain.some(i=>before[i]!==target[i]))return {state:'uncertain',reason:'变化位置的识别置信度不足，等候下一帧'};
 if(equal(before,target))return {state:'unchanged',moves:[]};
 if(before.filter((p,i)=>p!==target[i]).length>4)return {state:'uncertain',reason:'局面变化过大，需重新核对'};
 const targetFen=writeFen(target).split(' ')[0],board=new rules.Board('xiangqi',writeFen(before,position.side));let nodes=0,overLimit=false;const found=[];
 const legal=()=>board.legalMoves().trim().split(/\s+/).filter(Boolean),same=()=>board.fen().split(' ')[0]===targetFen;
 try{
  const first=legal();for(const move of first){board.push(move);if(same())found.push([move]);board.pop();}
  if(!found.length)for(const move of first){board.push(move);for(const reply of legal()){if(++nodes>maxNodes){overLimit=true;break;}board.push(reply);if(same())found.push([move,reply]);board.pop();}board.pop();if(overLimit||found.length>1)break;}
  return found.length===1&&!overLimit?{state:'move',moves:found[0]}:{state:'uncertain',reason:overLimit?'同步搜索达到上限，请重新核对':found.length?'走棋顺序不唯一，请重新核对':'画面无法对应一至两步合法走法'};
 }finally{board.delete();}
}
