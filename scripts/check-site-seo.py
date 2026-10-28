"""Check the public site's HTML and sitemap before deployment (no dependencies)."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
import json, re, xml.etree.ElementTree as ET
root = Path(__file__).resolve().parent.parent
class Page(HTMLParser):
    def __init__(self, html):
        super().__init__(); self.tags=[]; self.feed(html)
    def handle_starttag(self, tag, attrs): self.tags.append((tag,dict(attrs)))
errors=[]; titles={}; descriptions={}
urls=[n.text for n in ET.parse(root/'sitemap.xml').findall('.//{*}loc')]
for url in urls:
    path=urlsplit(url).path
    file=root/(path.lstrip('/') or 'index.html')
    if not file.is_file(): errors.append(f'Missing sitemap target {url}'); continue
    html=file.read_text(); p=Page(html)
    meta={a.get('name',a.get('property')):a.get('content','') for t,a in p.tags if t=='meta'}
    title=re.search(r'<title>(.*?)</title>',html,re.S)
    title=title.group(1) if title else ''
    canonical=[a.get('href') for t,a in p.tags if t=='link' and a.get('rel')=='canonical']
    if not title: errors.append(f'{file.name}: missing title')
    if not meta.get('description'): errors.append(f'{file.name}: missing description')
    if canonical != [url]: errors.append(f'{file.name}: canonical differs from sitemap')
    if 'noindex' in meta.get('robots',''): errors.append(f'{file.name}: sitemap page is noindex')
    if sum(t=='h1' for t,a in p.tags)!=1: errors.append(f'{file.name}: must have one h1')
    for mapping,value,label in [(titles,title,'title'),(descriptions,meta.get('description'),'description')]:
        if value in mapping: errors.append(f'{file.name}: duplicate {label} with {mapping[value]}')
        mapping[value]=file.name
    for raw in re.findall(r'<script type="application/ld\+json">(.*?)</script>',html,re.S):
        try: json.loads(raw)
        except ValueError: errors.append(f'{file.name}: invalid JSON-LD')
    for tag,a in p.tags:
        if tag=='img' and 'alt' not in a: errors.append(f'{file.name}: missing image alt')
        for attr in (['href'] if tag=='a' else ['src'] if tag in ('img','script') else []):
            value=a.get(attr,''); target=urlsplit(value)
            if target.scheme or target.netloc or not target.path or target.path.startswith('/pages/'): continue
            local=root/target.path.lstrip('/') if value.startswith('/') else file.parent/target.path
            if target.path=='/':local=root/'index.html'
            if not local.exists(): errors.append(f'{file.name}: missing local {value}')
print(f'Checked {len(urls)} sitemap pages: titles, descriptions, canonical URLs, headings, JSON-LD, image alt text, local links.')
if errors:
    print('\n'.join(errors)); raise SystemExit(1)
print('PASS')
