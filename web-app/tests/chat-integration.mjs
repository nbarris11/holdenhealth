// Run manually against a local built portal, with CHAT_VAPID_PRIVATE_KEY='' on
// the server. Creates synthetic accounts/program only; always cleans them up.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
const base=process.env.CHAT_TEST_BASE || 'http://localhost:3011';
const fixture=process.env.CHAT_TEST_FIXTURE ? JSON.parse(readFileSync(process.env.CHAT_TEST_FIXTURE,'utf8')) : null;
const service=fixture ? null : createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const ids=[],clients=[];let session;
async function checked(result){if(result.error)throw result.error;return result.data;}
async function api(c,path='',body,status=200){const r=await fetch(base+'/api/chat'+path,{method:body?'POST':'GET',headers:{Cookie:c.cookie,Origin:base,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;}
try {
 for(const role of ['member','other','coach']) {
 let user,password,email;
 if(fixture){const saved=fixture.users.find(u=>u.role===role);user={id:saved.id};password=saved.password;email=saved.email;ids.push(user.id);}
 else {
 password=randomUUID()+'Aa!9';email=`chat-qa-${role}-${randomUUID()}@example.invalid`;
 ({user}=await checked(await service.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:'TEST Messaging '+role}})));ids.push(user.id);
 await checked(await service.from('profiles').upsert({id:user.id,full_name:'TEST Messaging '+role}));
 if(role==='coach')await checked(await service.from('staff_roles').insert({user_id:user.id,role:'admin'}));
 }
 const jar=new Map();const db=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(c=>jar.set(c.name,c.value))}});
 await checked(await db.auth.signInWithPassword({email,password}));clients.push({id:user.id,db,cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')});
 }
 const [member,other,coach]=clients;
 if(!fixture){session=await checked(await service.from('sessions').insert({name:'TEST Messaging HTTP',slug:'test-chat-'+randomUUID(),starts_on:'2026-09-01',ends_on:'2099-09-30',status:'active',address_line:'TEST only',capacity:20,new_member_price_cents:10000}).select('id').single());
 await checked(await service.from('enrollments').insert({session_id:session.id,member_id:member.id,status:'active'}));
 }else session={id:fixture.session};
 const rooms=await api(member);const group=rooms.conversations.find(c=>c.title==='TEST Messaging HTTP');assert.ok(group?.can_write);
 const dm=fixture && base.startsWith('http://localhost') ? rooms.conversations.find(c=>c.member_id===member.id) : await api(member,'',{action:'start'});assert.ok(dm.id);
 const requestId=randomUUID();const payload={action:'send',conversation:dm.id,body:'TEST private message',clientId:requestId};
 const sent=await api(member,'',payload);const duplicate=await api(member,'',payload);assert.equal(sent.id,duplicate.id);
 const privateMessages=await api(coach,`?conversation=${dm.id}`);assert.equal(privateMessages.messages.length,1);
 await api(other,`?conversation=${dm.id}`,undefined,404);
 await api(other,'',{action:'send',conversation:dm.id,body:'TEST forbidden',clientId:randomUUID()},400);
 await api(member,'',{action:'send',conversation:group.id,body:'TEST group message',clientId:randomUUID()});
 await api(coach,'',{action:'send',conversation:dm.id,body:'TEST coach reply',clientId:randomUUID()});
 const inbox=await api(member);assert.equal(inbox.conversations.find(c=>c.id===dm.id).unread,1);
 const list=await api(member,`?conversation=${dm.id}`);assert.equal(list.messages.length,2);
 await api(member,'',{action:'mute',conversation:dm.id,muted:true});
 await api(member,'',{action:'read',conversation:dm.id,lastId:list.messages.at(-1).id});
 const read=(await api(member)).conversations.find(c=>c.id===dm.id);assert.equal(read.unread,0);assert.equal(read.muted,true);
 await api(coach,'',{action:'pin',conversation:dm.id,message:sent.id,pinned:true});assert.equal((await api(member,`?conversation=${dm.id}`)).pinned.length,1);
 await api(coach,'',{action:'remove',conversation:dm.id,message:sent.id});assert.equal((await api(member,`?conversation=${dm.id}`)).messages[0].body,'Message removed by Kelsey.');
 await api(coach,'',{action:'close',conversation:dm.id,closed:true});await api(member,'', {...payload,clientId:randomUUID()},400);
 if(!fixture || !base.startsWith('http://localhost')){const own=await api(coach,'',{action:'start',member:other.id});assert.ok(own.id);}
 const fake={endpoint:'https://fcm.googleapis.com/fcm/send/TEST-'+randomUUID(),keys:{p256dh:'A'.repeat(87),auth:'B'.repeat(22)}};
 // Disabled delivery also intentionally disables subscription registration.
 if(!fixture)await api(member,'',{action:'subscribe',subscription:fake},400);
 if(!fixture)await api(member,'',{action:'subscribe',subscription:{...fake,endpoint:'https://127.0.0.1/push'}},400);
 const csrf=await fetch(base+'/api/chat',{method:'POST',headers:{Cookie:member.cookie,Origin:'https://attacker.invalid'},body:JSON.stringify({action:'start'})});assert.equal(csrf.status,403);
 assert.equal((await fetch(base+'/api/chat')).status,401);
 for(const [client,path] of [[member,'/portal/communicate'],[coach,'/admin/communicate']]){const r=await fetch(base+path,{headers:{Cookie:client.cookie}});assert.equal(r.status,200);assert.ok((await r.text()).includes('Communicate'));}
 const manifest=await (await fetch(base+'/manifest.webmanifest')).json();assert.equal(manifest.display,'standalone');assert.equal((await fetch(base+'/chat-sw.js')).status,200);
 console.log('PASS: authenticated inbox, group send, private send/reply, duplicate retry, isolation, unread/mute persistence, pin/remove/close, CSRF, anonymous denial, rendered routes, manifest/service worker.');
} finally {
 for(const c of clients)await c.db.auth.signOut({scope:'global'});
 if(!fixture){if(session)await checked(await service.from('sessions').delete().eq('id',session.id));
 for(const id of ids)await checked(await service.auth.admin.deleteUser(id));
 const remaining=await checked(await service.from('profiles').select('id').in('id',ids));assert.equal(remaining.length,0);console.log('Disposable accounts, conversations, messages, and program removed.');}else console.log('Test sessions revoked; exact fixture cleanup is required by the calling test runner.');
}
