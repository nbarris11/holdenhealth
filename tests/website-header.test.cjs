const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const exportsForTest={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('web-app/src/lib/website-header.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsForTest,URL});
const {normalizeHeader,validHeaderLink}=exportsForTest;
test('missing header settings preserve current navigation and registration',()=>{
 const h=normalizeHeader(null);
 assert.equal(h.join_label,'Join group classes');
 assert.equal(h.join_url,'https://portal.holden.health/register');
 assert.equal(h.join_visible,true);
 assert.equal(h.call_visible,true);
});
test('published labels and visibility survive normalization',()=>{
 const h=normalizeHeader({join_label:'Join the session',join_visible:false});
 assert.equal(h.join_label,'Join the session');
 assert.equal(h.join_visible,false);
});
test('header links reject executable and cross-host shorthand URLs',()=>{
 for(const url of ['javascript:alert(1)','//example.com','/\\example.com','https://name:password@example.com'])assert.equal(validHeaderLink(url),false);
 for(const url of ['/index.html#the-app','/book.html','https://portal.holden.health/register'])assert.equal(validHeaderLink(url),true);
 assert.equal(normalizeHeader({join_url:'javascript:alert(1)'}).join_url,'https://portal.holden.health/register');
});
