export const START_FEN='rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';
export const LABELS={K:'帅',A:'仕',B:'相',N:'马',R:'车',C:'炮',P:'兵',k:'将',a:'士',b:'象',n:'马',r:'车',c:'炮',p:'卒'};
export const opposite=s=>s==='w'?'b':'w';
export const color=p=>p===p.toUpperCase()?'w':'b';
export const xy=i=>[i%9,Math.floor(i/9)];
export const square=i=>String.fromCharCode(97+i%9)+(10-Math.floor(i/9));
export function index(s){const m=s.match(/^([a-i])(10|[1-9])$/);if(!m)return -1;return (10-Number(m[2]))*9+m[1].charCodeAt(0)-97;}
export function splitMove(m){const p=m.match(/^([a-i](?:10|[1-9]))([a-i](?:10|[1-9]))$/);if(!p)return null;return [index(p[1]),index(p[2])];}
export function readFen(text){
 const fields=text.trim().split(/\s+/),rows=fields[0]?.split('/');if(rows?.length!==10)throw Error('局面需要十行棋盘。');
 const board=[];for(const row of rows){let n=0;for(let p of row){if(/[1-9]/.test(p)){const k=Number(p);board.push(...Array(k).fill(null));n+=k;}else{p=({h:'n',H:'N',e:'b',E:'B'})[p]||p;if(!LABELS[p])throw Error('局面包含无法识别的棋子。');board.push(p);n++;}}if(n!==9)throw Error('棋盘每行应有九个交叉点。');}
 if(fields[1]&&!['w','b'].includes(fields[1]))throw Error('先走方应为 w（红）或 b（黑）。');
 return {board,side:fields[1]||'w'};
}
export function writeFen(board,side='w'){
 if(!Array.isArray(board)||board.length!==90)throw Error('棋盘数据错误。');
 const rows=[];for(let y=0;y<10;y++){let row='',empty=0;for(let x=0;x<9;x++){const p=board[y*9+x];if(p){if(empty)row+=empty;empty=0;row+=p;}else empty++;}if(empty)row+=empty;rows.push(row);}return rows.join('/')+` ${side} - - 0 1`;
}
const ADVISORS={w:new Set([66,68,76,84,86]),b:new Set([3,5,13,21,23])};
const ELEPHANTS={w:new Set([47,51,63,67,71,83,87]),b:new Set([2,6,18,22,26,38,42])};
export function placementErrors(board){
 const errors=[],limit={k:1,a:2,b:2,n:2,r:2,c:2,p:5};for(const side of ['w','b']){
  const who=side==='w'?'红方':'黑方',counts={};let king=-1;
  board.forEach((p,i)=>{if(!p||color(p)!==side)return;const type=p.toLowerCase();counts[type]=(counts[type]||0)+1;const[x,y]=xy(i);
   if(type==='k'){king=i;if(x<3||x>5||(side==='w'?y<7:y>2))errors.push(`${who}将帅须在九宫内。`);}
   if(type==='a'&&!ADVISORS[side].has(i))errors.push(`${who}士的位置不合法。`);
   if(type==='b'&&!ELEPHANTS[side].has(i))errors.push(`${who}象的位置不合法。`);
   if(type==='p'&&(side==='w'?(y>6||(y>=5&&x%2!==0)):(y<3||(y<=4&&x%2!==0))))errors.push(`${who}兵卒的位置不合法。`);
  });
  if(king<0)errors.push(`请放置${who}${side==='w'?'帅':'将'}。`);
  for(const[t,n]of Object.entries(counts))if(n>limit[t])errors.push(`${who}${LABELS[side==='w'?t.toUpperCase():t]}数量超出规则。`);
 }
 const a=board.indexOf('K'),b=board.indexOf('k');if(a>=0&&b>=0&&a%9===b%9){let blocked=false;for(let i=Math.min(a,b)+9;i<Math.max(a,b);i+=9)if(board[i])blocked=true;if(!blocked)errors.push('将帅照面，请检查棋子位置。');}
 return [...new Set(errors)];
}
export function chineseMove(board,move){
 const pair=splitMove(move);if(!pair)return move;const[a,b]=pair,p=board[a];if(!p)return move;
 const[x,y]=xy(a),[tx,ty]=xy(b),red=color(p)==='w',numerals=red?'一二三四五六七八九':'１２３４５６７８９',file=x=>numerals[red?8-x:x];
 let name=LABELS[p]+file(x);const same=board.map((q,i)=>q===p&&i%9===x?i:-1).filter(i=>i>=0).sort((i,j)=>red?i-j:j-i);
 if(same.length===2)name=(same[0]===a?'前':'后')+LABELS[p];else if(same.length===3)name=['前','中','后'][same.indexOf(a)]+LABELS[p];else if(same.length>3)name=numerals[same.indexOf(a)]+LABELS[p];
 if(y===ty)return name+'平'+file(tx);
 const action=(red?ty<y:ty>y)?'进':'退';return name+action+(['n','a','b'].includes(p.toLowerCase())?file(tx):numerals[Math.abs(ty-y)-1]);
}
export function moveBoard(board,move){const p=splitMove(move);if(!p)return board.slice();const b=board.slice();b[p[1]]=b[p[0]];b[p[0]]=null;return b;}
export function lineNotation(board,moves){let b=board.slice();return moves.map(m=>{const text=chineseMove(b,m);b=moveBoard(b,m);return text;});}
export function parseInfo(line){
 if(!line.startsWith('info ')||!line.includes(' pv '))return null;
 const get=k=>{const m=line.match(new RegExp('(?:^| )'+k+' ([^ ]+)'));return m?Number(m[1]):null;},score=line.match(/ score (cp|mate) (-?\d+)/),pv=line.split(' pv ')[1]?.trim().split(/\s+/).filter(m=>splitMove(m));
 if(!score||!pv?.length)return null;return {depth:get('depth')||0,rank:get('multipv')||1,nodes:get('nodes')||0,nps:get('nps')||0,time:get('time')||0,scoreType:score[1],score:Number(score[2]),pv,bound:/ score .* (upperbound|lowerbound)(?: |$)/.test(line)};
}
