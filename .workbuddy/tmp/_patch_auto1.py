# -*- coding: utf-8 -*-
import io,re,sys
p='src/core.js'
s=io.open(p,encoding='utf-8').read()
orig=s

# 1) 每套氛围补一个「推荐版式」rec（一键成书要用它），插在 ui:{ 之前
REC={
 'studio':"{layout:'mat',alts:['full']}",
 'cream' :"{layout:'sticker',alts:['mat']}",
 'peach' :"{layout:'mat',alts:['sticker']}",
 'mist'  :"{layout:'mat',alts:['full']}",
 'mint'  :"{layout:'full',alts:['mat']}",
 'sakura':"{layout:'full',alts:['mat']}",
 'french':"{layout:'mat',alts:['full']}",
}
cnt=0
def rep(m):
    global cnt
    key=m.group('key')
    if key not in REC: return m.group(0)
    cnt+=1
    return m.group('tpls')+"\n    rec:"+REC[key]+",\n"+m.group('pre')+"ui:{"
pat=re.compile(r"(?P<key>\w+):\{name:'[^']*',hint:'[^']*',\n(?P<tpls>    tpls:/[[^/]]*/],)/n(?P<pre>    )ui:/{")
s=pat.sub(rep,s)
print('rec inserted:',cnt)
assert cnt==7, 'rec insert count %d'%cnt

# 2) studio 的推荐序列里补上「杂志」（11 套模版里原本只有它没被任何氛围推荐）
before="    tpls:['polaroid','film','minimal','postcard'],"
after ="    tpls:['polaroid','magazine','film','minimal'],"
assert s.count(before)==1, 'studio tpls anchor %d'%s.count(before)
s=s.replace(before,after)
print('studio tpls -> magazine: ok')

io.open(p,'w',encoding='utf-8').write(s)
print('len',len(orig),'->',len(s))
