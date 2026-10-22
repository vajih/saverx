"""Apply the Relief reading UI; preserve published article bodies and integrations."""
from pathlib import Path
import re,html
ROOT=Path(__file__).resolve().parents[1]
LEARN=sorted(p for p in (ROOT/'learn').glob('*.html') if p.name!='index.html')
COMPARE=[ROOT/n for n in ['ozempic-vs-wegovy.html','mounjaro-vs-ozempic.html','wegovy-vs-mounjaro.html']]
CSS='<link rel="stylesheet" href="/assets/css/article-pages.css">'
JS='<script src="/assets/js/article-pages.js" defer></script>'
def plain(s):return html.unescape(re.sub('<[^>]*>','',s)).strip()
def art(comparison=False,brands=()):
 if comparison:return '<div class="reader-art reader-art-pair" aria-hidden="true"><div class="reader-orbit"></div><div class="reader-note"><small>ONE OPTION</small><span>'+brands[0]+'</span></div><div class="reader-note"><small>ANOTHER OPTION</small><span>'+brands[1]+'</span></div><i>✳</i><p>A little perspective.</p></div>'
 return '<div class="reader-art" aria-hidden="true"><div class="reader-orbit"></div><div class="reader-book"><small>THE SAVERX<br>FIELD GUIDE</small><span>A little<br>clarity.</span><b>✳</b></div><i>✳</i><p>Good questions. Clearer answers.</p></div>'
def toc(links,mobile=False):
 nav='<nav aria-label="'+('Mobile article contents' if mobile else 'Article contents')+'"><ol class="reader-contents">'+''.join(f'<li><a href="#{id}">{label}</a></li>' for id,label in links)+'</ol></nav>'
 if mobile:return '<details class="reader-mobile-contents"><summary>In this guide <span aria-hidden="true">↗</span></summary>'+nav+'</details>'
 return '<aside class="article-sidebar"><div class="toc-card"><p class="reader-kicker">A LITTLE DIRECTION</p><h2>In this guide</h2>'+nav+'</div><div class="reader-sidebar-note"><span aria-hidden="true">✳</span><h3>Your next small step.</h3><p>Find your medication and explore official manufacturer programs.</p><a href="/drugs/">Explore savings ↗</a></div></aside>'
def related(current,comparison=False):
 pages=[p for p in (COMPARE if comparison else LEARN) if p!=current][:3]
 cards=[]
 for i,p in enumerate(pages):
  s=p.read_text();title=plain(re.search(r'<h1\b[^>]*>(.*?)</h1>',s,re.S).group(1))
  cards.append(f'<a class="reader-related-card" href="/{p.relative_to(ROOT).as_posix()}"><span class="reader-related-num">0{i+1}</span><h3>{html.escape(title)}</h3><span class="reader-related-link">Read the guide ↗</span></a>')
 return '<section class="reader-related" aria-label="Related guides"><div class="reader-related-heading"><div><p class="reader-kicker">KEEP A LITTLE CLARITY GOING</p><h2>Another good place to look.</h2></div><a href="'+('/comparisons.html' if comparison else '/learn/')+'">All '+('comparisons' if comparison else 'guides')+' ↗</a></div><div class="reader-related-grid">'+''.join(cards)+'</div></section>'
for p in LEARN+COMPARE:
 s=p.read_text()
 if 'reader-page' in re.search(r'<body\b[^>]*>',s).group(0):continue
 comparison=p in COMPARE
 s=re.sub(r'(<body\b[^>]*class=")([^"]*)',lambda m:m[1]+m[2]+' reader-page'+(' reader-comparison' if comparison else ''),s,count=1)
 s=s.replace('</head>',CSS+'\n</head>',1)
 s=s.replace('</body>',JS+'\n</body>',1)
 s=s.replace('<a class="relief-skip" href="#top">','<a class="relief-skip" href="#main-content">')
 progress='<div class="reader-progress" aria-hidden="true"><span></span></div>'
 if comparison:
  match=re.search(r'<main\b[^>]*>(.*?)</main>',s,re.S);inner=match[1]
  head=re.search(r'<header\b[^>]*>(.*?)</header>',inner,re.S)
  title=plain(re.search(r'<h1[^>]*>(.*?)</h1>',head[1],re.S)[1])
  lead=re.search(r'<p class="lead"[^>]*>(.*?)</p>',head[1],re.S)[1]
  body=re.search(r'<article>(.*?)</article>',inner,re.S)[1].replace(head[0],'',1)
  body=re.sub(r'\sstyle="[^"]*"','',body)
  body=re.sub(r'(?m)^[ \t]+$','',body)
  links=[]
  def heading(m):
   n=len(links)+1;id='guide-section-'+str(n);links.append((id,plain(m[1])));return f'<h2 id="{id}">{m[1]}</h2>'
  body=re.sub(r'<h2>(.*?)</h2>',heading,body,flags=re.S)
  body=re.sub(r'(<table\b.*?</table>)',r'<div class="reader-table-wrap" role="region" aria-label="Medication program comparison" tabindex="0">\1</div>',body,flags=re.S)
  brands=p.stem.split('-vs-');brands=[b.capitalize() for b in brands]
  split=title.split(':',1);h1=html.escape(split[0])+(': <em>'+html.escape(split[1].strip())+'</em>' if len(split)>1 else '')
  hero='<header class="article-hero"><div class="container">'+art(True,brands)+'<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/comparisons.html">Compare programs</a></nav><p class="article-label">THE SAVERX COMPARISON GUIDE</p><h1 class="article-title">'+h1+'</h1><p class="article-hook">'+lead+'</p><div class="article-meta"><span>Prescription savings</span><span>·</span><span>A side-by-side guide</span></div></div></header>'
  main=progress+'<main id="main-content" class="reader-main">'+hero+toc(links,True)+'<div class="article-layout"><article class="article-body">'+body+'</article>'+toc(links)+'</div>'+related(p,True)+'</main>'
  s=s[:match.start()]+main+s[match.end():]
 else:
  s=s.replace('<div class="article-hero">',progress+'<main id="main-content" class="reader-main"><div class="article-hero">',1)
  hero_at=s.index('<div class="article-hero">');container_at=s.index('<div class="container">',hero_at)+len('<div class="container">')
  s=s[:container_at]+art()+s[container_at:]
  s=s.replace('<span>Learn</span>','<a href="/learn/">Savings guides</a>',1)
  # Emphasis changes typography only; the original title words stay intact.
  def title_em(m):
   t=m[1];split=re.split(r'( — |: )',t,maxsplit=1)
   if len(split)==3:t=split[0]+split[1]+'<em>'+split[2]+'</em>'
   return '<h1 class="article-title">'+t+'</h1>'
  s=re.sub(r'<h1 class="article-title">(.*?)</h1>',title_em,s,count=1,flags=re.S)
  aside=re.search(r'<aside class="article-sidebar".*?</aside>',s,re.S)
  links=[(id,plain(label)) for id,label in re.findall(r'<a href="#([^"]+)">(.*?)</a>',aside[0],re.S)]
  s=s[:aside.start()]+toc(links)+s[aside.end():]
  s=s.replace('<div class="article-layout">',toc(links,True)+'<div class="article-layout">',1)
  band=s.index('<section class="cta-article-band"')
  s=s[:band]+related(p)+s[band:]
  # Close the semantic main before the existing modal; preserve forms/scripts.
  end=s.index('</section>',s.index('<section class="cta-article-band"'))+len('</section>')
  s=s[:end]+'\n</main>'+s[end:]
 p.write_text(s)
print('Applied article UI to five learning guides and three comparisons.')
