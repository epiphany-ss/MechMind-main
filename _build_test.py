# -*- coding: utf-8 -*-
import re, subprocess, sys, os

src = open('personal_knowledge.html', encoding='utf-8').read()

def grab(startkw, endkw):
    i = src.find(startkw)
    assert i >= 0, startkw
    j = src.find(endkw, i)
    assert j >= 0, endkw
    return src[i:j]

fc = grab('const FULL_COURSE={', 'const EXTRA_COURSE=')
rt = grab('const RELATED_TOPICS={', 'function buildLocalState')
b3d = grab('function build3dData(){', 'function show3dError')
crl = grab('function collectRelatedLinks(node){', 'function position3dPopup')
g3d = grab('function g3dIsRelatedToFocus(', 'function setG3dFocus')

tests = u'''
var d = build3dData();
console.log('[build3dData] nodes=' + d.nodes.length + ' links=' + d.links.length + ' bad=' + d.links.filter(function(l){return !l.source || !l.target;}).length);

function labelOf(fid){ return FULL_COURSE.nodes[parseInt(String(fid).substring(3),10)] ? FULL_COURSE.nodes[parseInt(String(fid).substring(3),10)].label : null; }
var focusId = 'fc_' + d.nodes.findIndex(function(n){return n.label === '速度瞬心';});
var relId   = 'fc_' + d.nodes.findIndex(function(n){return n.label === '瞬心法';});
var nrelId  = 'fc_' + d.nodes.findIndex(function(n){return n.label === '静力学基础';});

['速度瞬心','静力学基础','牛顿第二定律','分析力学基础','点的合成运动'].forEach(function(label){
  var rel = collectRelatedLinks({label:label});
  console.log('[related] ' + label + ' -> ' + rel.length + ' : ' + rel.slice(0,6).map(function(r){return r.label;}).join(','));
});

console.log('[focus] 瞬心法 与 速度瞬心 相邻(应true): ' + g3dIsRelatedToFocus(focusId, relId));
console.log('[focus] 静力学基础 与 速度瞬心 相邻(应false): ' + g3dIsRelatedToFocus(focusId, nrelId));
console.log('[focus] 自身(应true): ' + g3dIsRelatedToFocus(focusId, focusId));
'''

open('_vt.js', 'w', encoding='utf-8').write(fc + '\n' + rt + '\n' + b3d + '\n' + crl + '\n' + g3d + '\n' + tests)
print('harness built')
r = subprocess.run(['node', '_vt.js'], capture_output=True, text=True)
print(r.stdout)
print(r.stderr)
for f in ('_vt.js', '_sc.js'):
    if os.path.exists(f):
        os.remove(f)
sys.exit(r.returncode)
