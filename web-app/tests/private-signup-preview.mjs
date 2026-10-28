// Synthetic source-rendered browser fixture; no database access, email or payment.
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
const out='/tmp/holden-private-signup-preview';fs.mkdirSync(out,{recursive:true});
function load(path,imports){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:k=>imports[k],process:{env:{}}});return exports;}
const noop=async()=>{};
const Submit=load('../src/app/register/private/submit.tsx',{'react-dom':{useFormStatus:()=>({pending:false})},'react/jsx-runtime':jsx}).default;
const offer={id:'11111111-1111-4111-8111-111111111111',full_name:'Sample Member',email:'sample@example.invalid',attendance_time:'Saturday 9:00 AM',amount_cents:5000,expires_at:'2099-01-01',email_sent_at:null};
const Page=load('../src/app/register/private/page.tsx',{'react/jsx-runtime':jsx,'@/lib/private-class-times':{classConfirmationLine:()=> 'Saturday, October 17, 2026 at 9:00 AM Eastern'},'@/components/brand-logo':{default:()=>jsx.jsx('strong',{children:'Holden Health'})},'@/components/privacy-notice':{default:()=>jsx.jsx('p',{children:'Your health information stays private.'})},'@/lib/private-signup':{getPrivateSignup:async()=>({offer,session:{name:'Sample Session',starts_on:'2026-10-13',ends_on:'2026-11-21'},order:null,meetings:[{id:'meeting',starts_at:'2026-10-17T13:00:00Z',is_zoom:false}]})},'./actions':{payPrivateSignup:noop},'./submit':{default:Submit}}).default;
const admin={from:()=>({select(){return this;},eq(){return this;},order:async()=>({data:[offer]})})};
const Admin=load('../src/app/admin/people/private-signups.tsx',{'react/jsx-runtime':jsx,'@/lib/supabase/admin':{createAdminClient:()=>admin},'@/lib/private-signup':{CLASS_TIMES:['Saturday 7:30 AM','Saturday 9:00 AM'],privateSignupUrl:()=> 'https://example.invalid/private'},'./private-signup-actions':{createPrivateSignup:noop,emailPrivateSignup:noop,extendPrivateSignup:noop},'@/app/register/private/submit':{default:Submit}}).default;
const css=fs.readFileSync(new URL('../src/app/globals.css',import.meta.url),'utf8');
for(const[name,element]of [['member',await Page({searchParams:Promise.resolve({token:offer.id})})],['admin',await Admin({sessionId:'sample',message:'created'})]])fs.writeFileSync(`${out}/${name}.html`,`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${renderToStaticMarkup(element)}</body></html>`);
console.log(out);
