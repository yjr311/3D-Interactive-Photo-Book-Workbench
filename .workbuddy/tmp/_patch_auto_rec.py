# -*- coding: utf-8 -*-
import io, re

p = 'src/core.js'
s = io.open(p, encoding='utf-8').read()
orig = s

REC = {
    'studio': "{layout:'mat',alts:['full']}",
    'cream':  "{layout:'sticker',alts:['mat']}",
    'peach':  "{layout:'mat',alts:['sticker']}",
    'mist':   "{layout:'mat',alts:['full']}",
    'mint':   "{layout:'full',alts:['mat']}",
    'sakura': "{layout:'full',alts:['mat']}",
    'french': "{layout:'mat',alts:['full']}",
}

pat = re.compile(
    r"(?P<key>\w+):\{name:'[^']*',hint:'[^']*',\n"
    r"[\s\S]*?"
    r"(?P<tpls>[ \t]*tpls:\[[^\]]*\],)\n"
    r"(?P<pre>[ \t]*)ui:\{"
)

cnt = [0]


def rep(m):
    key = m.group('key')
    if key not in REC:
        return m.group(0)
    cnt[0] += 1
    return (m.group('tpls') + "\n    rec:" + REC[key] + ",\n"
            + m.group('pre') + "ui:{")


s = pat.sub(rep, s)
print('rec inserted:', cnt[0])
assert cnt[0] == 7, 'rec insert count %d' % cnt[0]

before = "    tpls:['polaroid','film','minimal','postcard'],"
after = "    tpls:['polaroid','magazine','film','minimal'],"
assert s.count(before) == 1, 'studio tpls anchor %d' % s.count(before)
s = s.replace(before, after)
print('studio tpls -> magazine: ok')

io.open(p, 'w', encoding='utf-8').write(s)
print('len', len(orig), '->', len(s))
