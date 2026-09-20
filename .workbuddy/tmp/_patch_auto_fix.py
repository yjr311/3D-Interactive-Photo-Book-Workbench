# -*- coding: utf-8 -*-
"""修复被上一次正则误伤的 SKINS 区块：还原全部字段，并补上 tpls/rec。"""
import io

p = 'src/core.js'
s = io.open(p, encoding='utf-8').read()

NEW = r"""const SKINS={
  studio:{name:'原味',hint:'暗房 · 米白纸 · 琥珀光',
    tplPaper:'',tplInk:'',tplKraft:'',
    bookPaper:'#fffdf8',bookInk:'#2b2620',cover:'#e8e0d2',
    accent:'#e08a3c',accent2:'',handRole:'hand',grain:1,radius:14,
    tpls:['polaroid','magazine','film','minimal'],
    rec:{layout:'mat',alts:['full']},
    ui:{dark:'#f0a63c',light:'#c0740e',ink:'#1a1206'},sw:['#e8e0d2','#e08a3c']},
  cream:{name:'奶油日记',hint:'暖奶白 · 焦糖字 · 手写日历',
    tplPaper:'#fffaf0',tplInk:'#4a3f33',tplKraft:'#d9c3a4',
    bookPaper:'#f7ecd9',bookInk:'#4a3f33',cover:'#e8d7ba',
    accent:'#c98a52',accent2:'#e8cfa8',handRole:'hand',grain:1.15,radius:16,
    tpls:['polaroid','kraft','postcard','minimal'],
    rec:{layout:'sticker',alts:['mat']},
    ui:{dark:'#d69a56',light:'#a86a2e',ink:'#241a0c'},sw:['#f7ecd9','#c98a52']},
  peach:{name:'蜜桃气泡',hint:'粉白纸 · 蜜桃色 · 软圆角',
    tplPaper:'#fff7f4',tplInk:'#4a3b38',tplKraft:'#eac6b2',
    bookPaper:'#fbe9e4',bookInk:'#4a3b38',cover:'#f2cec4',
    accent:'#ff8f7a',accent2:'#ffd9c9',handRole:'hand',grain:.85,radius:18,
    tpls:['polaroid','postcard','grid9','minimal'],
    rec:{layout:'mat',alts:['sticker']},
    ui:{dark:'#fa8f78',light:'#d9614a',ink:'#3a140c'},sw:['#fbe9e4','#ff8f7a']},
  mist:{name:'雾紫梦境',hint:'雾紫纸 · 衬线字 · 轻雾感',
    tplPaper:'#fbf9ff',tplInk:'#3d3850',tplKraft:'#c9bfdd',
    bookPaper:'#f0eafb',bookInk:'#3d3850',cover:'#dcd2ef',
    accent:'#9b8ad4',accent2:'#d8d0f0',handRole:'serif',grain:.9,radius:16,
    tpls:['minimal','postcard','titlecard','duotone'],
    rec:{layout:'mat',alts:['full']},
    ui:{dark:'#a996e0',light:'#6f5cb8',ink:'#180f38'},sw:['#f0eafb','#9b8ad4']},
  mint:{name:'薄荷苏打',hint:'薄荷白 · 无衬线 · 干净清爽',
    tplPaper:'#f7fdfb',tplInk:'#2f4741',tplKraft:'#bfd9cd',
    bookPaper:'#e7f5f0',bookInk:'#2f4741',cover:'#c5e0d7',
    accent:'#3fbf9c',accent2:'#c8ede2',handRole:'sans',grain:.8,radius:16,
    tpls:['minimal','grid9','postcard','titlecard'],
    rec:{layout:'full',alts:['mat']},
    ui:{dark:'#4fc9a6',light:'#1c8a6c',ink:'#04241c'},sw:['#e7f5f0','#3fbf9c']},
  sakura:{name:'夜樱',hint:'深底书 · 浅色印片 · 樱粉字',
    tplPaper:'#f2eaf4',tplInk:'#2a2333',tplKraft:'#c8b6d0',
    bookPaper:'#241f2b',bookInk:'#efe6f2',cover:'#3a2f42',
    accent:'#f28aa8',accent2:'#c98ad4',handRole:'serif',grain:1.1,radius:16,
    tpls:['cinematic','neon','duotone','titlecard'],
    rec:{layout:'full',alts:['mat']},
    ui:{dark:'#f2879f',light:'#c9476a',ink:'#2a0512'},sw:['#3a2f42','#f28aa8']},
  french:{name:'法式午后',hint:'米白纸 · 陶土色 · 老照片',
    tplPaper:'#fdfcf7',tplInk:'#2c2a26',tplKraft:'#d6cdb8',
    bookPaper:'#f4efe1',bookInk:'#2c2a26',cover:'#d8cfba',
    accent:'#c07a5e',accent2:'#dcd2c0',handRole:'serif',grain:1.25,radius:14,
    tpls:['postcard','kraft','film','polaroid'],
    rec:{layout:'mat',alts:['full']},
    ui:{dark:'#c98d6e',light:'#9a5a3c',ink:'#2a1108'},sw:['#f4efe1','#c07a5e']}
};
"""

i = s.find('const SKINS={')
assert i >= 0, 'SKINS head not found'
j = s.find('\n};', i)
assert j > i, 'SKINS tail not found'
j += len('\n};')
old = s[i:j]
print('replacing %d chars with %d' % (len(old), len(NEW)))
s = s[:i] + NEW.rstrip('\n') + s[j:]

# 头部字段说明补上 tpls / rec
a = "     sw               氛围卡片上的双色示意（纸色|强调色）\n"
b = ("     sw               氛围卡片上的双色示意（纸色|强调色）\n"
     "     tpls             这套氛围推荐的模版序列。「一键氛围成书」按它循环铺给入册照片，\n"
     "                      于是 28 张不会整本一个样，又保持同一套气质。\n"
     "     rec              推荐的版式 {layout,alts}：一键成书用它定 book.layout，\n"
     "                      「换一版」在 layout 与 alts 之间轮换。\n")
assert s.count(a) == 1, 'doc anchor %d' % s.count(a)
s = s.replace(a, b)

io.open(p, 'w', encoding='utf-8').write(s)
print('written, len', len(s))
