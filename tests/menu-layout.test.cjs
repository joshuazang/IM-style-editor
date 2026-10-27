const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const place = vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/menu-layout.js'), 'utf8') + ';imMenuPosition');
const viewport = {left: 0, top: 0, width: 390, height: 844};
const bottom = place({anchor: {top: 740,bottom:790,right:380}, point:{x:300,y:770}, width:260,height:270,viewport,touch:true});
assert.ok(bottom.y+270<=728);
assert.ok(bottom.x>=8 && bottom.x+260<=382);
const top = place({anchor:{top:20,bottom:60,right:380},point:{x:300,y:40},width:260,height:270,viewport,touch:true});
assert.ok(top.y>=72);
for (const viewport of [{left:0,top:0,width:390,height:844},{left:0,top:100,width:320,height:240},{left:40,top:80,width:200,height:260}]) {
  for (let offset=20;offset<viewport.height-20;offset+=20) {
    const point={x:viewport.left+viewport.width/2,y:viewport.top+offset};
    const result=place({anchor:{top:point.y-20,bottom:point.y+20,right:point.x+80},point,width:260,height:900,viewport,touch:true});
    assert.ok(result.x>=viewport.left+8);
    assert.ok(result.x+result.maxWidth<=viewport.left+viewport.width-8+.01);
    assert.ok(result.y>=viewport.top+8);
    assert.ok(result.y+result.maxHeight<=viewport.top+viewport.height-8+.01);
    assert.ok(result.y+result.maxHeight<=point.y-24+.01 || result.y>=point.y+24-.01);
  }
}
const desktop=place({anchor:{},point:{x:1180,y:890},width:220,height:300,viewport:{left:0,top:0,width:1200,height:900},touch:false});
assert.ok(desktop.x+220<=1192 && desktop.y+300<=892);
console.log('PASS: top/bottom placement, finger clearance, keyboard/pinch viewport bounds, tall menus and desktop clamping');
