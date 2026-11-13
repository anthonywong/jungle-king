/* Iterative-deepening negamax + alpha-beta + capture extension, isolated in a Web Worker. */
function createAI(R){
  'use strict';
  const value=[0,430,230,300,380,530,820,920,850],INF=1000000,MATE=100000;
  let deadline,nodes,tt,rootHistory;
  const now=()=>typeof performance!=='undefined'?performance.now():Date.now();
  // Static shortest-route distances account for both river shape and leaping units.
  const distances={};
  for(const side of [1,-1])for(let rank=1;rank<=8;rank++){
    const target=R.den(-side),d=Array(63).fill(30);d[target]=0;
    for(let iter=0;iter<20;iter++){
      let changed=false;
      for(let i=0;i<63;i++){
        if(i===R.den(side)||R.water(i)&&rank!==1)continue;
        const b=Array(63).fill(0);b[i]=rank*side;
        for(const m of R.movesFrom({board:b,turn:side},i))if(d[m.to]+1<d[i]){d[i]=d[m.to]+1;changed=true;}
      }
      if(!changed)break;
    }
    distances[side+':'+rank]=d;
  }
  function evaluate(s){
    let score=0;const nearest={1:30,'-1':30};
    for(let i=0;i<63;i++){
      const p=s.board[i];if(!p)continue;const side=Math.sign(p),r=Math.abs(p),x=i%7,y=(i/7)|0,d=distances[side+':'+r][i];
      nearest[side]=Math.min(nearest[side],d);
      let v=value[r]+(12-d)*21+(3-Math.abs(3-x))*8;
      const ownDist=Math.abs(x-3)+Math.abs(y-(side===1?8:0));
      if(ownDist<=2)v+=35;
      if(R.traps[i]===-side)v-=value[r]*0.22;
      if(r===1&&R.water(i))v+=45;
      if(d===1)v+=220;
      score+=side*v;
    }
    score+=(nearest[-1]-nearest[1])*38;
    return score*s.turn;
  }
  function moveKey(m){return m.from*64+m.to;}
  function order(s,list,preferred){
    return list.map(m=>{
      const rank=Math.abs(s.board[m.from]);let v=0;
      if(m.to===R.den(-s.turn))v+=100000;
      if(m.capture)v+=5000+value[Math.abs(m.capture)]*8-value[rank];
      if(preferred===moveKey(m))v+=50000;
      v+=(distances[s.turn+':'+rank][m.from]-distances[s.turn+':'+rank][m.to])*32;
      if(R.traps[m.to]===-s.turn)v-=20;
      return {m,v};
    }).sort((a,b)=>b.v-a.v).map(x=>x.m);
  }
  function terminal(s,ply){
    if(s.result)return s.result.winner===0?0:(s.result.winner===s.turn?MATE-ply:-MATE+ply);
    if(s.quiet>=100)return 0;
    return null;
  }
  function checkTime(){nodes++;if((nodes&127)===0&&now()>deadline)throw 'timeout';}
  function search(s,depth,alpha,beta,ply,qleft,path){
    checkTime();const term=terminal(s,ply);if(term!==null)return term;
    const k=R.key(s), prior=(rootHistory.get(k)||0)+(path.get(k)||0);
    // rootHistory contains the root itself; path contains descendants already on this line.
    if(prior>=2)return 0;
    let list=R.moves(s);if(!list.length)return -MATE+ply;
    const orig=alpha;
    if(depth<=0){
      const stand=evaluate(s);if(qleft<=0)return stand;
      if(stand>=beta)return beta;alpha=Math.max(alpha,stand);
      list=list.filter(m=>m.capture||m.to===R.den(-s.turn));if(!list.length)return stand;
    }
    const entry=tt.get(k);if(depth>0&&entry&&entry.depth>=depth&&prior===0){
      if(entry.flag==='exact')return entry.score;
      if(entry.flag==='lower')alpha=Math.max(alpha,entry.score);else beta=Math.min(beta,entry.score);
      if(alpha>=beta)return entry.score;
    }
    let best=depth<=0?evaluate(s):-INF,bestMove=null;
    path.set(k,(path.get(k)||0)+1);
    for(const m of order(s,list,entry?.move)){
      const n=R.quick(s,m),score=-search(n,depth-1,-beta,-alpha,ply+1,depth<=0?qleft-1:qleft,path);
      if(score>best){best=score;bestMove=m;}alpha=Math.max(alpha,score);if(alpha>=beta)break;
    }
    const count=path.get(k)-1;if(count)path.set(k,count);else path.delete(k);
    if(depth>0&&prior===0&&tt.size<60000)tt.set(k,{depth,score:best,move:moveKey(bestMove),flag:best<=orig?'upper':best>=beta?'lower':'exact'});
    return best;
  }
  function choose(state,level='normal',seed=0){
    if(state.result)return {move:null,nodes:0,depth:0,score:0};
    const cfg={easy:{depth:2,ms:230},normal:{depth:4,ms:850},hard:{depth:6,ms:1900},hint:{depth:4,ms:850}}[level]||{depth:4,ms:850};
    const start=now();deadline=start+cfg.ms;nodes=0;tt=new Map();rootHistory=new Map();
    // Exclude current root, so a descendant completing the third occurrence is a draw.
    for(const k of state.history.slice(0,-1))rootHistory.set(k,(rootHistory.get(k)||0)+1);
    let list=order(state,R.moves(state)),best=list[0],bestScore=-INF,completed=0;
    if(!best)return {move:null,nodes,depth:0,score:-MATE};
    const rootPath=new Map([[R.key(state),1]]);
    for(let depth=1;depth<=cfg.depth;depth++){
      let current=list[0],scoreBest=-INF,alpha=-INF;const scored=[];
      try{
        for(const m of list){
          let score=-search(R.quick(state,m),depth-1,-INF,-alpha,1,2,new Map(rootPath));
          scored.push({m,score});if(score>scoreBest){scoreBest=score;current=m;}alpha=Math.max(alpha,score);
          if(now()>deadline)throw 'timeout';
        }
        best=current;bestScore=scoreBest;completed=depth;
        list=scored.sort((a,b)=>b.score-a.score).map(x=>x.m);
        if(Math.abs(scoreBest)>MATE-200)break;
      }catch(e){if(e!=='timeout')throw e;break;}
    }
    return {move:best,nodes,depth:completed,score:bestScore,time:Math.round(now()-start)};
  }
  return {choose,evaluate};
}
if(typeof module!=='undefined')module.exports=createAI;
