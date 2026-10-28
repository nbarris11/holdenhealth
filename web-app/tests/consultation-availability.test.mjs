import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function fixture(result='slot-created',denied=false){
 const effects=[];const exports={};
 const imports={
 'next/cache':{revalidatePath:path=>effects.push(['refresh',path])},
 'next/navigation':{redirect:path=>{throw Error(path);}},
 '@/lib/auth':{verifyAdmin:async()=>{effects.push(['auth']);if(denied)throw Error('denied');}},
 '@/lib/supabase/server':{createClient:async()=>({rpc:async(name,args)=>{effects.push(['rpc',name,args]);return {data:result,error:result==='failure'?{}:null};}})},
 '@/lib/manual-consultation':{manualConsultationTime:(date,time)=>date==='2027-01-10'&&time==='14:15'?new Date('2027-01-10T19:15:00Z'):null},
 };
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/app/admin/consultations/availability-actions.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:k=>imports[k],Date});
 const form=new FormData();form.set('date','2027-01-10');form.set('time','14:15');
 return {run:()=>exports.publishSingleConsultationSlot(form),effects,form};
}
test('single availability uses authenticated atomic publication and accepts quarter-hour times',async()=>{
 const f=fixture();await assert.rejects(f.run(),/message=slot-created/);
 assert.deepEqual(f.effects.map(x=>x[0]),['auth','rpc','refresh']);
 assert.equal(f.effects[1][1],'publish_consultation_slot');assert.equal(f.effects[1][2].p_starts_at,'2027-01-10T19:15:00.000Z');
});
test('closed, existing, conflicting, and failed saves show accurate outcomes',async()=>{
 for(const status of ['slot-reopened','time-exists','slot-booked','time-in-past']) await assert.rejects(fixture(status).run(),new RegExp('message='+status));
 for(const status of ['failure','unknown'])await assert.rejects(fixture(status).run(),/message=slot-create-failed/);
});
test('single availability rejects unauthorized and invalid input before writes',async()=>{
 let f=fixture('slot-created',true);await assert.rejects(f.run(),/denied/);assert.equal(f.effects.length,1);
 f=fixture();f.form.set('date','bad');await assert.rejects(f.run(),/time-in-past/);assert.equal(f.effects.length,1);
});
