"""Guard published content and form contracts while changing article chrome."""
from pathlib import Path
from html.parser import HTMLParser
import subprocess,re,collections
ROOT=Path(__file__).resolve().parents[1]
BASE='d04838ed'
pages=sorted(p for p in (ROOT/'learn').glob('*.html') if p.name!='index.html')+[ROOT/n for n in ['ozempic-vs-wegovy.html','mounjaro-vs-ozempic.html','wegovy-vs-mounjaro.html']]
class Scan(HTMLParser):
 def __init__(self):super().__init__();self.ids=[];self.links=[];self.main=0;self.h1=0
 def handle_starttag(self,t,attrs):
  a=dict(attrs)
  if a.get('id'):self.ids.append(a['id'])
  if t=='a' and a.get('href','').startswith('#') and a['href']!='#':self.links.append(a['href'][1:])
  if t=='main':self.main+=1
  if t=='h1':self.h1+=1
class Text(HTMLParser):
 def __init__(self):super().__init__();self.data=[]
 def handle_data(self,s):self.data.append(s)
def text(s):
 p=Text();p.feed(s);return ' '.join(' '.join(p.data).split())
for p in pages:
 path=p.relative_to(ROOT).as_posix();s=p.read_text();old=subprocess.check_output(['git','show',f'{BASE}:{path}'],cwd=ROOT,text=True)
 parser=Scan();parser.feed(s)
 assert parser.main==1 and parser.h1==1,(path,'landmarks')
 assert len(parser.ids)==len(set(parser.ids)),(path,'duplicate IDs')
 assert set(parser.links)<=set(parser.ids),(path,'missing anchors',set(parser.links)-set(parser.ids))
 assert s.count('src="/assets/js/article-pages.js"')==1,path
 assert s.count('href="/assets/css/article-pages.css"')==1,path
 # Existing forms and script blocks are unchanged byte-for-byte.
 for pattern in [r'<form\b.*?</form>',r'<script\b(?![^>]*article-pages\.js)[^>]*>.*?</script>']:
  assert re.findall(pattern,old,re.S)==re.findall(pattern,s,re.S),(path,'integration changed')
 if p.parent.name=='learn':
  pattern=r'<article class="article-body">(.*?)</article>'
  assert re.search(pattern,old,re.S)[1]==re.search(pattern,s,re.S)[1],(path,'guide body changed')
 else:
  original=re.search(r'<article>(.*?)</article>',old,re.S)[1]
  original=re.sub(r'<header\b.*?</header>','',original,count=1,flags=re.S)
  current=re.search(r'<article class="article-body">(.*?)</article>',s,re.S)[1]
  assert text(original)==text(current),(path,'comparison text changed')
  assert re.findall(r'href="([^"]+)"',original)==re.findall(r'href="([^"]+)"',current),(path,'comparison destinations changed')
print('Validated eight article layouts, anchor targets, published content, existing forms and scripts.')
