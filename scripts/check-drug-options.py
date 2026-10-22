from pathlib import Path
from html.parser import HTMLParser
import subprocess,re,json
ROOT=Path(__file__).resolve().parents[1]
BASE='c29ac929'
class Scan(HTMLParser):
 def __init__(self):super().__init__();self.ids=[];self.fragments=[];self.main=0;self.h1=0
 def handle_starttag(self,t,attrs):
  d=dict(attrs)
  if d.get('id'):self.ids.append(d['id'])
  if t=='a' and d.get('href','').startswith('#') and d['href']!='#':self.fragments.append(d['href'][1:])
  if t=='main':self.main+=1
  if t=='h1':self.h1+=1
count=0
for p in list((ROOT/'drugs').glob('*/index.html'))+[ROOT/'templates/index.html']:
 s=p.read_text()
 if 'drug-options-page' not in s:continue
 path=p.relative_to(ROOT).as_posix();old=subprocess.check_output(['git','show',f'{BASE}:{path}'],cwd=ROOT,text=True)
 q=Scan();q.feed(s)
 assert q.main==1 and q.h1==1,(path,'main/H1')
 assert len(q.ids)==len(set(q.ids)),(path,'duplicate IDs')
 assert set(q.fragments)<=set(q.ids),(path,'fragment targets',set(q.fragments)-set(q.ids))
 assert s.count('id="drug-savings-calculator"')==1,path
 for pattern in [r'<form\b[^>]*id="footerForm".*?</form>',r'<form\b[^>]*id="modal-lead-form".*?</form>',r'<section\b[^>]*class="affiliate-cta".*?</section>']:
  assert re.findall(pattern,old,re.S)==re.findall(pattern,s,re.S),(path,'form/affiliate contract')
 for oldblock in re.findall(r'<script\b.*?</script>',old,re.S):
  if 'SaveRxDrugData.load' in oldblock:continue
  assert oldblock in s,(path,'existing script lost')
 for duplicate in ['class="rx-hero"','class="rx-body"','data-bind="annual_savings_formatted"','id="rx-ph-grid"']:
  assert duplicate not in s,(path,'repeated legacy cost section')
 assert s.count('saverx:drug-data')==1,(path,'data dispatch')
 count+=1
assert count>350,count
print(f'Validated {count} drug pages/templates: landmarks, fragments, forms, affiliate blocks, scripts, and no legacy duplicate price sections.')
