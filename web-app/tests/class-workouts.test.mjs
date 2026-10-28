import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as challenge from '../src/lib/challenge.ts';
import * as workoutApp from '../src/lib/workout-app.ts';
import * as timer from '../src/lib/workout-timer.ts';
function moduleAt(path, imports) {
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:key=>imports[key]||{},Date,Number,String,Boolean,JSON,Math});
 return exports;
}
const program=moduleAt('../src/lib/workout-program.ts',{'./challenge':challenge});
const classId='70200000-0000-4000-8000-000000000001', challengeId='70200000-0000-4000-8000-000000000002';
function harness({admin=true,readError=false}={}) {
 const writes=[],reads=[],invalidations=[];
 const db={from:table=>{let payload;const filters=[]; const q={select:()=>q,eq:(k,v)=>{filters.push([k,v]);return q;},maybeSingle:async()=>{reads.push(table);return readError?{error:{}}:{data:{starts_on:'2026-10-13',ends_on:'2026-11-21'}};},insert:v=>{payload=v;return q;},update:v=>{payload=v;return q;},single:async()=>{writes.push({table,payload,filters});return {data:{id:'saved'}};}};return q;}};
 const actions=moduleAt('../src/app/admin/challenges/actions.ts',{'@/lib/challenge':challenge,'@/lib/workout-app':workoutApp,'@/lib/workout-timer':timer,'@/lib/workout-program':program,'@/lib/auth':{verifyAdmin:async()=>{if(!admin)throw Error('denied');}},'@/lib/supabase/server':{createClient:async()=>db},'next/cache':{revalidatePath:p=>invalidations.push(p)},'next/navigation':{redirect:path=>{throw Error('redirect:'+path)}}});
 return {...actions,writes,reads,invalidations};
}
function form(scope='session_id') {const f=new FormData();for(const [key,value] of Object.entries({[scope]:scope==='session_id'?classId:challengeId,title:'Week one',minutes:'20',publish_on:'2026-10-13',plan:'Move comfortably.',steps:'[]',level:'All levels',focus:'Strength'}))f.set(key,value);return f;}
test('workout scope requires exactly one valid program and builds class library links',()=>{
 assert.equal(program.workoutScope('', ''),null);assert.equal(program.workoutScope(challengeId,classId),null);assert.equal(program.workoutScope('', 'invalid'),null);
 assert.equal(program.workoutScope('',classId).table,'sessions');assert.equal(program.workoutScope(challengeId,'').table,'habit_challenges');
 assert.equal(program.workoutLibraryPath({challenge_id:null,session_id:classId}),`/portal/workouts?program=${classId}`);
});
test('class draft save uses class dates, preserves private state, and refreshes editor and members',async()=>{
 const h=harness();await assert.rejects(h.saveWorkout({},form()),/redirect:.*workouts\?saved=saved/);assert.equal(h.reads[0],'sessions');assert.equal(h.writes[0].payload.session_id,classId);assert.equal(h.writes[0].payload.challenge_id,null);assert.equal(h.writes[0].payload.published,false);assert.ok(h.invalidations.includes('/admin/programs/[programId]/workouts'));assert.ok(h.invalidations.includes('/portal'));
});
test('published class edits are scoped to the same program and retain workout content',async()=>{
 const h=harness(),f=form();f.set('id','70400000-0000-4000-8000-000000000001');f.set('published','on');f.set('steps',JSON.stringify([{section:'Main work',title:'Chair squat',dose:'30 seconds',instructions:'Move comfortably.',easier:'Use the chair.',demo:''}]));
 assert.ok((await h.saveWorkout({},f)).success);assert.equal(h.writes[0].payload.published,true);assert.equal(h.writes[0].payload.steps[0].title,'Chair squat');assert.ok(h.writes[0].filters.some(([key,value])=>key==='session_id'&&value===classId));
});
test('ambiguous programs, invalid release dates, failed reads and non-admins cannot write',async()=>{
 for(const alter of [f=>f.set('challenge_id',challengeId),f=>f.set('publish_on','2026-10-12'),f=>f.set('publish_on','2026-11-22')]){const h=harness(),f=form();alter(f);assert.ok((await h.saveWorkout({},f)).error);assert.equal(h.writes.length,0);}
 const h=harness({readError:true});assert.ok((await h.saveWorkout({},form())).error);assert.equal(h.writes.length,0);
 const denied=harness({admin:false});await assert.rejects(denied.saveWorkout({},form()),/denied/);assert.equal(denied.writes.length,0);
});
test('existing free challenge workouts still use their challenge membership and dates',async()=>{
 const h=harness();assert.ok((await h.saveWorkout({},form('challenge_id'))).success);assert.equal(h.reads[0],'habit_challenges');assert.equal(h.writes[0].payload.challenge_id,challengeId);assert.equal(h.writes[0].payload.session_id,null);
});
