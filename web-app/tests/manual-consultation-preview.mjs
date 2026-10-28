// Render the real page with synthetic data for isolated layout checks. No network or email.
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
import {randomUUID} from 'node:crypto';
const out='/tmp/holden-manual-invite-preview';fs.mkdirSync(out,{recursive:true});
function load(path,imports){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:key=>imports[key]});return exports;}
const InviteSubmit=load('../src/app/admin/consultations/invite-submit.tsx',{'react-dom':{useFormStatus:()=>({pending:false})},'react/jsx-runtime':jsx}).default;
const slot={id:'slot',starts_at:'2027-01-10T19:15:00Z',duration_minutes:60,active:false};
const booking={id:'booking',slot_id:'slot',full_name:'Sample Guest',email:'guest@example.test',status:'booked',zoom_join_url:'https://zoom.us/j/sample',manually_created:true,visitor_invite_sent_at:null,coach_invite_sent_at:'2026-09-15'};
const chain=table=>({select(){return this;},gt(){return this;},eq(){return this;},order(){return Promise.resolve({data:table==='consultation_slots'?[slot]:[booking]});}});
const noop=async()=>{};
const Page=load('../src/app/admin/consultations/page.tsx',{'node:crypto':{randomUUID},'react/jsx-runtime':jsx,'@/app/actions':{cancelConsultationBooking:noop,closeConsultationSlot:noop,createConsultationSlot:noop,updateConsultationSlot:noop},'./manual-actions':{createManualConsultation:noop,retryManualConsultationInvites:noop},'./invite-submit':{default:InviteSubmit},'@/lib/auth':{verifyAdmin:noop},'@/lib/supabase/server':{createClient:async()=>({from:chain})}}).default;
const body=renderToStaticMarkup(await Page({searchParams:Promise.resolve({message:'invite-email-failed'})}));
const css=fs.readFileSync(new URL('../src/app/globals.css',import.meta.url),'utf8');
fs.writeFileSync(out+'/index.html',`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${body}</body></html>`);
console.log(out+'/index.html');
