const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');

const pages=fs.readdirSync('.').filter(f=>f.endsWith('.html')&&!/ 2\./.test(f));
const block=(html,start,end)=>{const i=html.indexOf(start);if(i<0)return '';return html.slice(i,html.indexOf(end,i)+end.length);};
const removed=['resources.html','#the-app','nutrition-coaching','portal.holden.health/challenge','portal.holden.health/register','Free 14-Day Challenge','The App'];

test('every page menu is Coaching (Group Fitness, Personal Training, Online Training) and About Me',()=>{
 for(const file of pages){
  const html=fs.readFileSync(file,'utf8');
  const nav=block(html,'<nav class="nav-links"','</nav>');
  assert.ok(nav,`${file} has a menu`);
  const hrefs=[...nav.matchAll(/href="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(hrefs,['/coaching.html','/personal-training.html','/fitness-coaching.html','/about.html'],file);
  assert.match(nav,/>Group Fitness</,file);
  assert.match(nav,/>About Me</,file);
  for(const gone of removed)assert.equal(nav.includes(gone),false,`${file} menu still has ${gone}`);
 }
});

test('header buttons are Log in and Free call only',()=>{
 for(const file of pages){
  const cta=block(fs.readFileSync(file,'utf8'),'<div class="nav-cta">','</div>');
  assert.deepEqual([...cta.matchAll(/href="([^"]+)"/g)].map(m=>m[1]),['https://portal.holden.health/login','/book.html'],file);
 }
});

test('the script-built menu matches the static menu',()=>{
 const js=fs.readFileSync('site.js','utf8');
 const fn=js.slice(js.indexOf('function applySiteNavigation'),js.indexOf('function refreshMobileLinks'));
 for(const gone of ['Free 14-Day Challenge','#the-app','The App','extras',"key:'join'",'Join group classes','resources'])assert.equal(fn.includes(gone),false,`site.js menu still has ${gone}`);
 assert.match(fn,/'Group Fitness'/);
 assert.match(fn,/'About Me'/);
});

test('stored-content defaults no longer show Resources, The App or the join button',()=>{
 const load=file=>{const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,URL,require:()=>({})});return exports;};
 const {normalizeHeader}=load('web-app/src/lib/website-header.ts');
 const h=normalizeHeader(null);
 for(const key of ['join_label','join_url','join_visible','app_label','app_url','app_visible','resources_label','resources_url','resources_all_label','consult_label','consult_url'])assert.equal(key in h,false,key);
 assert.equal(h.group_label,'Group Fitness');
 assert.equal(h.about_label,'About Me');
 assert.match(fs.readFileSync('web-app/src/lib/website-pages.ts','utf8'),/const defaultNavigationKeys = \["homepage", "coaching", "training", "about", "contact"\];/);
});
