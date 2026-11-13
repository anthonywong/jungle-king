/* Run with: node tests/rules.test.cjs. Uses only the Node standard library. */
'use strict';
const assert=require('node:assert/strict');
const R=require('../game/src/rules.js')(),A=require('../game/src/ai.js')(R);
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS',name);}
function setup(pieces,turn=1,quiet=0){const s={board:Array(63).fill(0),turn,ply:0,quiet,history:[],result:null};for(const [i,p] of pieces)s.board[i]=p;s.history=[R.key(s)];return s;}
const has=(s,a,b)=>R.movesFrom(s,a).some(m=>m.to===b);
test('Initial board: 8 unique pieces on each side',()=>{const s=R.initial();assert.equal(s.board.filter(x=>x>0).length,8);assert.equal(s.board.filter(x=>x<0).length,8);assert.equal(new Set(s.board.filter(Boolean)).size,16);});
test('Initial board has 180-degree side symmetry',()=>{const s=R.initial();for(let i=0;i<63;i++)assert.equal(s.board[i]||0,-s.board[62-i]||0);});
test('Initial board has 24 legal moves',()=>assert.equal(R.moves(R.initial()).length,24));
test('There are exactly 12 river squares',()=>assert.equal(Array.from({length:63},(_,i)=>R.water(i)).filter(Boolean).length,12));
test('There are three traps per side',()=>{assert.equal(Object.values(R.traps).filter(x=>x===1).length,3);assert.equal(Object.values(R.traps).filter(x=>x===-1).length,3);});
test('Only current side may move',()=>assert.equal(R.movesFrom(R.initial(),0).length,0));
test('No diagonal movement',()=>assert.equal(has(setup([[30,4],[0,-8]]),30,22),false));
test('Cannot move onto an allied piece',()=>assert.equal(has(setup([[30,4],[31,1],[0,-8]]),30,31),false));
test('Own den is forbidden',()=>assert.equal(has(setup([[52,4],[0,-8]]),52,59),false));
test('Edge movement cannot wrap rows',()=>assert.equal(has(setup([[27,2],[0,-8]]),27,28),false));
test('Higher rank captures lower',()=>assert.equal(has(setup([[31,4],[24,-3]]),31,24),true));
test('Equal ranks capture',()=>assert.equal(has(setup([[31,4],[24,-4]]),31,24),true));
test('Lower rank cannot capture higher',()=>assert.equal(has(setup([[31,2],[24,-4]]),31,24),false));
test('Rat captures elephant on land',()=>assert.equal(has(setup([[31,1],[24,-8]]),31,24),true));
test('Elephant does not capture rat',()=>assert.equal(has(setup([[31,8],[24,-1]]),31,24),false));
test('Rat may enter water without capture',()=>assert.equal(has(setup([[21,1],[0,-8]]),21,22),true));
test('Cat cannot enter water',()=>assert.equal(has(setup([[21,2],[0,-8]]),21,22),false));
test('Elephant cannot enter water',()=>assert.equal(has(setup([[21,8],[0,-7]]),21,22),false));
test('Rat cannot capture from water to land',()=>assert.equal(has(setup([[23,1],[24,-8]]),23,24),false));
test('Rat cannot capture from land to water',()=>assert.equal(has(setup([[21,1],[22,-1]]),21,22),false));
test('Two rats can capture within water',()=>assert.equal(has(setup([[22,1],[23,-1]]),22,23),true));
test('Rat can exit water to an empty land square',()=>assert.equal(has(setup([[23,1],[0,-8]]),23,24),true));
test('Lion leaps horizontally over river',()=>{const s=setup([[21,7],[0,-8]]);assert.equal(has(s,21,24),true);assert.equal(R.movesFrom(s,21).find(m=>m.to===24).jump,true);});
test('Tiger also leaps horizontally over river',()=>assert.equal(has(setup([[21,6],[0,-8]]),21,24),true));
test('Lion leaps vertically over all three river ranks',()=>assert.equal(has(setup([[15,7],[0,-8]]),15,43),true));
test('Tiger leaps vertically over all three river ranks',()=>assert.equal(has(setup([[15,6],[0,-8]]),15,43),true));
test('Friendly rat blocks a river leap',()=>assert.equal(has(setup([[21,7],[22,1],[0,-8]]),21,24),false));
test('Enemy rat blocks a river leap',()=>assert.equal(has(setup([[21,7],[23,-1]]),21,24),false));
test('A rat off the leap line does not block',()=>assert.equal(has(setup([[21,7],[29,-1]]),21,24),true));
test('Tiger cannot leap-capture a lion',()=>assert.equal(has(setup([[21,6],[24,-7]]),21,24),false));
test('Lion can leap-capture tiger',()=>assert.equal(has(setup([[21,7],[24,-6]]),21,24),true));
test('Trap weakens enemy elephant for defending cat',()=>assert.equal(has(setup([[51,2],[58,-8]]),51,58),true));
test('Trap overrides elephant-vs-rat immunity',()=>assert.equal(has(setup([[51,8],[58,-1]]),51,58),true));
test('An animal on its own trap is not weakened',()=>assert.equal(has(setup([[17,2],[10,-8]]),17,10),false));
test('Leaving an enemy trap restores capture strength',()=>assert.equal(has(setup([[10,7],[11,-4]]),10,11),true));
test('Entering enemy den ends game immediately',()=>{const n=R.apply(setup([[10,2],[20,-4]]),{from:10,to:3});assert.deepEqual(n.result,{winner:1,reason:'den'});});
test('Capturing last opposing animal wins',()=>{const n=R.apply(setup([[31,4],[24,-2]]),{from:31,to:24});assert.deepEqual(n.result,{winner:1,reason:'elimination'});});
test('No legal moves is a loss',()=>{const n=R.apply(setup([[56,2],[49,-8],[57,-4],[48,-3]],-1),{from:48,to:47});assert.deepEqual(n.result,{winner:-1,reason:'immobile'});});
test('Illegal moves throw rather than alter state',()=>{const s=R.initial(),original=R.key(s);assert.throws(()=>R.apply(s,{from:56,to:0}));assert.equal(R.key(s),original);});
test('Completed game rejects further moves',()=>{const s=R.apply(setup([[10,2],[20,-4]]),{from:10,to:3});assert.throws(()=>R.apply(s,{from:20,to:19}));});
test('Threefold repetition includes side to move',()=>{let s=setup([[42,4],[20,-4]]);for(let k=0;k<2;k++)for(const [from,to] of [[42,43],[20,19],[43,42],[19,20]])s=R.apply(s,{from,to});assert.deepEqual(s.result,{winner:0,reason:'repetition'});});
test('100 non-capture plies are a draw',()=>{const n=R.apply(setup([[42,4],[20,-4]],1,99),{from:42,to:43});assert.deepEqual(n.result,{winner:0,reason:'quiet'});});
test('Captures reset the no-progress counter',()=>{const n=R.apply(setup([[31,4],[24,-2],[0,-8]],1,99),{from:31,to:24});assert.equal(n.quiet,0);assert.equal(n.result,null);});
test('Saved-state validation accepts normal state',()=>assert.equal(R.validSaved(R.initial()),true));
test('Saved-state validation rejects duplicate animal IDs',()=>{const s=R.initial();s.board[30]=7;assert.equal(R.validSaved(s),false);});
test('Saved-state validation rejects non-rat in river',()=>{const s=setup([[22,6],[0,-8]]);assert.equal(R.validSaved(s),false);});
test('Saved-state validation rejects invalid history',()=>{const s=R.initial();s.history=[{}];assert.equal(R.validSaved(s),false);});
test('AI finds immediate den win at every difficulty',()=>{for(const level of ['easy','normal','hard']){const s=setup([[10,2],[20,-4],[56,7]]);assert.equal(A.choose(s,level).move.to,3);}});
test('AI prevents immediate den loss',()=>{const s=setup([[51,4],[58,-2],[0,-8],[48,1]]);assert.equal(A.choose(s,'normal').move.to,58);});
test('AI makes the rat/elephant tactical capture',()=>{const s=setup([[31,1],[24,-8],[56,7],[6,-6]]);const m=A.choose(s,'normal').move;assert.equal(m.from,31);assert.equal(m.to,24);});
test('AI returns no move in a finished game',()=>{const s=R.initial();s.result={winner:1,reason:'den'};assert.equal(A.choose(s).move,null);});
test('Deterministic random playout invariants (12,000+ plies)',()=>{
 let seed=5017,total=0;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
 for(let game=0;game<100;game++){let s=R.initial();for(let turn=0;turn<180&&!s.result;turn++){
  const list=R.moves(s);assert.ok(list.length>0);const m=list[Math.floor(random()*list.length)],before=s.board.filter(Boolean).length,n=R.apply(s,m);
  assert.equal(n.board.filter(Boolean).length,before-(m.capture?1:0));assert.equal(n.turn,-s.turn);assert.ok(R.validSaved(n));assert.equal(n.board[m.from],0);assert.equal(Math.sign(n.board[m.to]),s.turn);s=n;total++;
 }}assert.ok(total>12000);console.log('  verified',total,'plies');
});
test('Four AI-vs-AI games: every reply is legal and each terminates',()=>{
 let results=[];for(let g=0;g<4;g++){let s=R.initial();for(let t=0;t<350&&!s.result;t++){
  const answer=A.choose(s,'easy',g*19+t),m=answer.move;assert.ok(m);assert.ok(has(s,m.from,m.to));s=R.apply(s,m);
 }assert.ok(s.result);results.push({plies:s.ply,...s.result});}console.log(' ',JSON.stringify(results));
});
console.log(`\n${passed} tests passed.`);
