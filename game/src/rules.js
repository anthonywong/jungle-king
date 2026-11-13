/* Beast Ignition — deterministic Jungle rules; no network or runtime dependencies. */
function createRules() {
  'use strict';
  const W=7,H=9, SIDES=[1,-1], NAMES=['','鼠','貓','狗','狼','豹','虎','獅','象'];
  const traps={2:-1,4:-1,10:-1,52:1,58:1,60:1};
  const den=s=>s===1?59:3;
  const water=i=>{const x=i%7,y=(i/7)|0;return y>=3&&y<=5&&(x===1||x===2||x===4||x===5);};
  const key=s=>s.board.join(',')+':'+s.turn;
  function initial(){
    const b=Array(63).fill(0);
    [[0,-7],[6,-6],[8,-3],[12,-2],[14,-1],[16,-5],[18,-4],[20,-8]].forEach(([i,p])=>{b[i]=p;b[62-i]=-p;});
    const s={board:b,turn:1,ply:0,quiet:0,history:[],result:null};s.history=[key(s)];return s;
  }
  function canCapture(b,from,to){
    const a=b[from],v=b[to]; if(!a||!v||a*v>0)return false;
    // Captures may not cross a bank in either direction.
    if(water(from)!==water(to))return false;
    const ar=Math.abs(a),vr=Math.abs(v);
    // An enemy standing in OUR trap can be taken by any rank, including elephant vs rat.
    if(traps[to]===Math.sign(a))return true;
    if(ar===1&&vr===8)return true;
    if(ar===8&&vr===1)return false;
    return ar>=vr;
  }
  function movesFrom(s,from){
    const b=s.board,p=b[from],side=Math.sign(p),rank=Math.abs(p),out=[];
    if(!p||side!==s.turn)return out;
    const x=from%7,y=(from/7)|0;
    for(const [dx,dy] of [[0,-1],[-1,0],[1,0],[0,1]]){
      let nx=x+dx,ny=y+dy,jump=false,blocked=false;
      if(nx<0||nx>=7||ny<0||ny>=9)continue;
      let to=ny*7+nx;
      if(water(to)&&rank!==1){
        if(rank!==6&&rank!==7)continue;
        jump=true;
        while(nx>=0&&nx<7&&ny>=0&&ny<9&&water(ny*7+nx)){
          if(b[ny*7+nx]){blocked=true;break;}nx+=dx;ny+=dy;
        }
        if(blocked||nx<0||nx>=7||ny<0||ny>=9)continue;
        to=ny*7+nx;
      }
      if(to===den(side)||b[to]*side>0)continue;
      if(b[to]&&!canCapture(b,from,to))continue;
      out.push({from,to,capture:b[to]||0,jump});
    }
    return out;
  }
  function moves(s){const out=[];for(let i=0;i<63;i++)if(s.board[i]*s.turn>0)out.push(...movesFrom(s,i));return out;}
  function quick(s,m){
    const b=s.board.slice(),p=b[m.from],captured=b[m.to];b[m.to]=p;b[m.from]=0;
    let result=null;
    if(m.to===den(-s.turn))result={winner:s.turn,reason:'den'};
    else if(!b.some(x=>x*s.turn<0))result={winner:s.turn,reason:'elimination'};
    return {board:b,turn:-s.turn,ply:s.ply+1,quiet:captured?0:s.quiet+1,history:s.history,result};
  }
  function apply(s,move,validate=true){
    if(s.result)throw Error('Game has ended');
    const m=validate?movesFrom(s,move.from).find(x=>x.to===move.to):move;
    if(!m)throw Error('Illegal move');
    const n=quick(s,m),k=key(n);n.history=[...s.history,k];
    if(!n.result&&!moves(n).length)n.result={winner:s.turn,reason:'immobile'};
    if(!n.result&&n.history.filter(x=>x===k).length>=3)n.result={winner:0,reason:'repetition'};
    if(!n.result&&n.quiet>=100)n.result={winner:0,reason:'quiet'};
    return n;
  }
  const coord=i=>'ABCDEFG'[i%7]+(9-((i/7)|0));
  function validSaved(s){
    if(!s||!Array.isArray(s.board)||s.board.length!==63||![1,-1].includes(s.turn))return false;
    if(!Number.isInteger(s.ply)||s.ply<0||!Number.isInteger(s.quiet)||s.quiet<0||!Array.isArray(s.history)||s.history.length>5000||!s.history.every(k=>typeof k==='string'))return false;
    const seen=new Set();for(let i=0;i<63;i++){const p=s.board[i];if(!Number.isInteger(p)||Math.abs(p)>8)return false;if(!p)continue;if(seen.has(p)||water(i)&&Math.abs(p)!==1||i===den(Math.sign(p)))return false;seen.add(p);}
    if(s.result&&(![1,-1,0].includes(s.result.winner)||!['den','elimination','immobile','repetition','quiet'].includes(s.result.reason)))return false;
    return true;
  }
  return {W,H,SIDES,NAMES,traps,den,water,key,initial,canCapture,movesFrom,moves,quick,apply,coord,validSaved};
}
if(typeof module!=='undefined')module.exports=createRules;
