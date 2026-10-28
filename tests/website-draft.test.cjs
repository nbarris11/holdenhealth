const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function load(file){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,FormData,URL});return exports;}
const {validatePageContent}=load('web-app/src/lib/website-content-validation.ts');
const page={sections:[{fields:[{key:'heading',label:'Headline',kind:'text',maxLength:240}]}]};
const content={heading:'Existing heading',mini_heading:'Keep legacy promotion',visual_overrides:'[]',custom_sections:'[]',published_at:'2026-10-27'};
test('publication preserves legacy copy and reviewed whitespace',()=>{
 const raw={...content,visual_overrides:JSON.stringify([{selector:'h1',text:'  A headline\nwith spacing  '}])};
 const clean=validatePageContent(page,raw);
 assert.equal(clean.mini_heading,content.mini_heading);
 assert.equal(JSON.parse(clean.visual_overrides)[0].text,'  A headline\nwith spacing  ');
 assert.equal(clean.published_at,undefined);
});
test('invalid links prevent the whole publication',()=>{
 assert.throws(()=>validatePageContent(page,{...content,visual_overrides:JSON.stringify([{selector:'a',href:'javascript:alert(1)'}])}));
 assert.throws(()=>validatePageContent(page,{...content,custom_sections:JSON.stringify([{id:'section-example',template:'call-to-action',theme:'light',buttonUrl:'javascript:alert(1)'}])}));
});
test('unsupported structure and excessive payloads fail before publishing',()=>{
 assert.throws(()=>validatePageContent(page,{...content,visual_overrides:'{}'}));
 assert.throws(()=>validatePageContent(page,{...content,custom_sections:JSON.stringify(Array.from({length:21},()=>({})))}));
});
