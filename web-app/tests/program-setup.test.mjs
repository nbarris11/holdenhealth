import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

test('creating a future program saves a private draft and its class schedule', async () => {
  let savedProgram, savedMeetings;
  const db = { from(table) {
    if (table === 'sessions') return { insert(value) { savedProgram = value; return { select() { return { single: async () => ({data:{id:'new-program'},error:null}) }; } }; } };
    if (table === 'class_meetings') return { insert: async value => { savedMeetings = value; return {error:null}; } };
    throw Error(`Unexpected table: ${table}`);
  } };
  const exports = {};
  const imports = {
    '@/app/admin/consultations/availability-actions':{}, '@supabase/supabase-js':{},
    'next/cache':{revalidatePath:()=>{}}, 'next/headers':{},
    'next/navigation':{redirect:url=>{throw Error(url);}},
    '@/lib/auth':{verifyAdmin:async()=>({userId:'coach'})}, '@/lib/email':{}, '@/lib/stripe':{},
    '@/lib/posthog-server':{}, '@/lib/supabase/admin':{}, '@/lib/supabase/server':{createClient:async()=>db},
    '@/lib/zoom':{}, '@/lib/registration-schedule':{},
    '@/lib/program-schedule':{programMeetingDates:()=>[{date:'2099-01-06',time:'06:00'},{date:'2099-01-07',time:'19:00'}]},
  };
  const source = fs.readFileSync(new URL('../src/app/actions.ts',import.meta.url),'utf8');
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:key=>imports[key],crypto:{randomUUID:()=> 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'},process:{env:{}}});
  const form = new FormData();
  for (const [key,value] of Object.entries({name:'Focus on You: January',description:'Coached classes and check-ins.',format:'all-classes',startsOn:'2099-01-06',endsOn:'2099-01-20',firstPrice:'139',secondPrice:'99',capacity:'25'})) form.set(key,value);
  await assert.rejects(exports.createClassProgram(form),/admin\/settings\?program=new-program&created=1/);
  assert.equal(savedProgram.status,'draft');
  assert.equal(savedProgram.published,false);
  assert.equal(savedProgram.two_day_price_cents,null);
  assert.equal(savedProgram.new_member_price_cents,13900);
  assert.equal(savedProgram.returning_member_price_cents,9900);
  assert.equal(savedMeetings.length,2);
  assert.ok(savedMeetings.every(meeting=>meeting.session_id==='new-program' && !meeting.drop_in_enabled));
});
