const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const exportsForTest={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('web-app/src/lib/website-header.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsForTest,URL});
const {normalizeHeader,validHeaderLink}=exportsForTest;
test('missing header settings fall back to the current menu and buttons',()=>{
 const h=normalizeHeader(null);
 assert.equal(h.group_label,'Group Fitness');
 assert.equal(h.about_label,'About Me');
 assert.equal(h.call_visible,true);
});
test('published labels and visibility survive normalization',()=>{
 const h=normalizeHeader({call_label:'Book a call',call_visible:false});
 assert.equal(h.call_label,'Book a call');
 assert.equal(h.call_visible,false);
});
test('header links reject executable and cross-host shorthand URLs',()=>{
 for(const url of ['javascript:alert(1)','//example.com','/\\example.com','https://name:password@example.com'])assert.equal(validHeaderLink(url),false);
 for(const url of ['/index.html#top','/book.html','https://portal.holden.health/login'])assert.equal(validHeaderLink(url),true);
 assert.equal(normalizeHeader({call_url:'javascript:alert(1)'}).call_url,'/book.html');
});
