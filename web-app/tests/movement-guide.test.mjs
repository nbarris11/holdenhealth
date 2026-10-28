import assert from 'node:assert/strict';
import {test} from 'node:test';
import {movementGuide,movementRound,restSecondsRemaining} from '../src/lib/movement-guide.ts';
test('guide selection matches complete exercise names, not dangerous lookalikes',()=>{
 assert.equal(movementGuide('Round 2 · Goblet squat').id,'squat');
 assert.equal(movementGuide('  Wall push-up  ').id,'wall');
 assert.equal(movementGuide('Single-leg Romanian deadlift'),null);
 assert.equal(movementGuide('Goblet squat jump'),null);
 assert.equal(movementGuide('Dumbbell chest press'),null);
 assert.equal(movementGuide('Optional third round'),null);
});
test('circuit labels keep optional third round separate from two programmed rounds',()=>{
 const titles=['Warm up','Round 1 · Goblet squat','Round 2 · Goblet squat','Optional third round'];
 assert.deepEqual(movementRound(titles[2],titles),{title:'Goblet squat',label:'Round 2 of 2'});
 assert.equal(movementRound(titles[3],titles).label,'Optional round 3');
 assert.equal(movementRound('Warm up',titles).label,null);
});
test('rest countdown uses wall time, rounds up and never goes negative',()=>{
 assert.equal(restSecondsRemaining(31000,1000),30);
 assert.equal(restSecondsRemaining(31000,1501),30);
 assert.equal(restSecondsRemaining(31000,26000),5);
 assert.equal(restSecondsRemaining(31000,90000),0);
});
