const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto').webcrypto;
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync('middleware.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function gate(env={}) {
 const exports={};
 vm.runInNewContext(code,{exports,require:()=>({next:()=>new Response('public'),rewrite:url=>new Response(url.pathname)}),process:{env},Request,Response,URL,TextEncoder,crypto});
 return exports.default;
}
test('public pages and crawl files open without passwords or launch configuration',async()=>{
 for (const env of [{}, {PUBLIC_SITE_LIVE:'false', PREVIEW_PASSWORD:'obsolete'}]) {
  for (const path of ['/','/coaching.html','/privacy.html','/sitemap.xml','/robots.txt','/assets/logo.png']) {
   const response=await gate(env)(new Request('https://www.holden.health'+path));
   assert.equal(await response.text(),'public');
   assert.equal(response.headers.get('x-robots-tag'),null);
  }
 }
});
test('retired preview GET and HEAD links redirect permanently to the canonical homepage',async()=>{
 for(const host of ['www.holden.health','holden.health']) {
  for(const path of ['/preview.html','/preview-access']) {
   for(const method of ['GET','HEAD']) {
    const response=await gate()(new Request('https://'+host+path,{method}));
    assert.equal(response.status,308);
    assert.equal(response.headers.get('location'),'https://www.holden.health/');
   }
  }
 }
});
test('old preview form submissions become homepage GET requests',async()=>{
 const response=await gate()(new Request('https://holden.health/preview-access',{method:'POST'}));
 assert.equal(response.status,303);
 assert.equal(response.headers.get('location'),'https://www.holden.health/');
});
test('admin shortcut still leads to secure admin login',async()=>{
 const response=await gate()(new Request('https://www.holden.health/admin'));
 assert.equal(response.headers.get('location'),'https://portal.holden.health/admin/login');
});
test('canonical domain redirect preserves path and query',async()=>{
 const response=await gate()(new Request('https://holden.health/coaching.html?source=launch'));
 assert.equal(response.status,308);
 assert.equal(response.headers.get('location'),'https://www.holden.health/coaching.html?source=launch');
});
test('custom website pages keep their template rewrite',async()=>{
 const response=await gate()(new Request('https://www.holden.health/pages/new-program?source=launch'));
 assert.equal(await response.text(),'/custom-page.html');
});
