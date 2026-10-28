const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const pages=fs.readdirSync('.').filter(f=>f.endsWith('.html')&&!/ 2\./.test(f));
const read=f=>fs.readFileSync(f,'utf8');
const SENTENCE='4–6 week sessions offered throughout the year. Reach out today to find out which session is currently running!';

test('the homepage has no App section or session promotions',()=>{
 const html=read('index.html');
 assert.equal(html.includes('id="the-app"'),false);
 assert.equal(html.includes('data-featured-program'),false);
});

test('Group Fitness uses general wording with no prices, dates or direct sign-up',()=>{
 const html=read('coaching.html');
 assert.ok(html.includes(SENTENCE));
 for(const gone of ['data-featured-program','id="next-session"','register?session=','portal.holden.health/register','data-legacy-program-end'])assert.equal(html.includes(gone),false,gone);
 assert.equal(/\$\d/.test(html),false,'price on Group Fitness page');
});

test('no page links to removed pages or straight into portal sign-up',()=>{
 for(const file of pages){
  const html=read(file);
  for(const gone of ['href="resources.html"','href="/resources.html"','nutrition-coaching','#the-app','portal.holden.health/register','portal.holden.health/start','portal.holden.health/challenge'])
   assert.equal(html.includes(gone),false,`${file} still links to ${gone}`);
 }
});

test('removed pages redirect instead of 404ing',()=>{
 assert.equal(fs.existsSync('resources.html'),false);
 assert.equal(fs.existsSync('nutrition-coaching.html'),false);
 const redirects=JSON.parse(read('vercel.json')).redirects;
 const to=src=>redirects.find(r=>r.source===src);
 for(const [src,dest] of [['/resources.html','/'],['/resources','/'],['/nutrition-coaching.html','/coaching.html'],['/nutrition-coaching','/coaching.html']]){
  assert.equal(to(src)?.destination,dest,src);
  assert.equal(to(src)?.permanent,true,src);
 }
});

test('sitemap drops removed pages and keeps articles',()=>{
 const xml=read('sitemap.xml');
 assert.equal(xml.includes('resources.html'),false);
 assert.equal(xml.includes('nutrition-coaching'),false);
 for(const article of ['blog-all-or-nothing.html','beginners-guide-to-lifting.html','protein-habit.html','eating-out-with-your-goals.html'])assert.ok(xml.includes(article),article);
});

test('every internal link points at a page that exists',()=>{
 for(const file of pages){
  for(const [,href] of read(file).matchAll(/href="\/?([a-z0-9-]+\.html)(?:[#?][^"]*)?"/g))assert.ok(fs.existsSync(href),`${file} → ${href}`);
 }
});
