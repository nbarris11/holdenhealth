const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const exportsForTest={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('web-app/src/lib/website-pages.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsForTest});
const {websitePages}=exportsForTest;
const fileFor=pathname=>pathname==='/'?'index.html':pathname.slice(1);

test('every editor page still exists on the website',()=>{
 for(const page of websitePages)assert.ok(fs.existsSync(fileFor(page.pathname)),`${page.label} (${page.pathname}) has no page file`);
});

test('every editor text field has a matching hook in its page',()=>{
 for(const page of websitePages){
  const html=fs.readFileSync(fileFor(page.pathname),'utf8');
  for(const section of page.sections)for(const field of section.fields){
   if(field.key.startsWith('seo_'))continue;
   const attribute=field.kind==='link'?'data-site-link':'data-site-content';
   assert.ok(html.includes(`${attribute}="${field.key}"`),`${page.label}: "${field.label}" (${field.key}) has nothing to edit on the page`);
  }
 }
});
