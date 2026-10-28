const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const colors=require('../desktop/theme-colors.js'),{UIPreferences}=require('../desktop/ui-preferences.cjs');
test('palettes preserve readable text, semantic colors and button ink for custom accents',()=>{
 const accents=['#000000','#ffffff','#ffff00','#0000ff','#00ff00','#ff0000','#808080','#9b87f5'];
 for(let i=0;i<256;i++)accents.push('#'+[i,255-i,(i*57)%256].map(n=>n.toString(16).padStart(2,'0')).join(''));
 for(const mode of ['dark','light','violet'])for(const accent of accents){const p=colors.palette(mode,accent);for(const bg of ['bg','panel','raised'])for(const fg of ['ink','muted','link','danger','success','warning'])assert.ok(colors.contrast(p[fg],p[bg])>=4.5,mode+' '+accent+' '+fg+'/'+bg);assert.ok(colors.contrast(p.accent,p.accentInk)>=4.5,accent+' button');for(const bg of ['bg','panel','raised'])assert.ok(colors.contrast(p.focus,p[bg])>=3,accent+' focus');}
 assert.throws(()=>colors.hex('red'),/HEX/);assert.equal(colors.hex('#ABCDEF'),'#abcdef');
});
test('visual preferences migrate without replacing mode and retain custom accent across legacy queued saves',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'mooz-color-prefs-'));try{await fs.writeFile(path.join(dir,'ui-preferences.json'),JSON.stringify({theme:'light',size:'large'}));const settings=new UIPreferences(dir);assert.deepEqual(await settings.load(),{theme:'light',size:'large',accent:colors.DEFAULT_ACCENT});await Promise.all([settings.save({theme:'dark',size:'large',accent:'#00FF00'}),settings.save({theme:'light',size:'standard'})]);assert.deepEqual(await new UIPreferences(dir).load(),{theme:'light',size:'standard',accent:'#00ff00'});assert.throws(()=>settings.save({theme:'dark',size:'standard',accent:'url(secret)'}),/HEX/);assert.equal(settings.get().accent,'#00ff00');}finally{await fs.rm(dir,{recursive:true,force:true});}
});
