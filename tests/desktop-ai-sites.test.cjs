const test=require('node:test'),assert=require('node:assert/strict');
const {sites,providerForURL,patterns}=require('../ai-sites.js'),policy=require('../desktop/policy.cjs'),M=require('../desktop/batch/model.js');
test('Grok and Flow are exact HTTPS sites, including localized Flow projects, with no sibling tools or spoofed domains',()=>{
 for(const url of ['https://grok.com/','https://www.grok.com/c/abc'])assert.equal(providerForURL(url),'grok');
 for(const url of ['https://flow.google.com/','https://flow.google.com/project/abc','https://labs.google/fx/tools/flow','https://labs.google/fx/tools/flow/project/abc','https://labs.google/fx/vi/tools/flow/project/abc','https://labs.google/fx/en-US/tools/flow'])assert.equal(providerForURL(url),'flow');
 for(const url of ['https://grok.com.evil/','http://grok.com/','https://user@grok.com/','https://grok.com:123/','https://labs.google.evil/fx/tools/flow','https://labs.google/fx/tools/flow-evil','https://labs.google/fx/tools/imagefx','https://labs.google/','https://labs.google/fx/../../tools/flow'])assert.equal(providerForURL(url),null,url);
 for(const id of ['grok','flow'])assert.ok(patterns.some(p=>policy.matchesPattern(sites[id].start,p)));
});
test('Batch assigns Grok and Flow work only to explicitly selected matching tabs',()=>{
 const tabs=[{id:1,transport:'chrome',provider:'flow',url:sites.flow.start,title:'Flow'},{id:2,transport:'chrome',provider:'grok',url:sites.grok.start,title:'Grok'}];
 const workers=M.refreshWorkers([],tabs);assert.equal(workers.filter(w=>w.selected&&w.provider!=='local').length,0);
 const w={...M.defaultWorkflow(),steps:[{id:'video',type:'video',provider:'flow',name:'Video'},{id:'assemble',type:'assemble',provider:'local',name:'Ghép'}]};
 assert.throws(()=>M.validate(w,workers));assert.doesNotThrow(()=>M.validate(w,workers.map(t=>({...t,selected:true}))));
 w.steps[0].type='text';assert.throws(()=>M.validate(w,workers.map(t=>({...t,selected:true}))));assert.ok(M.capabilities.grok.includes('text'));assert.ok(!M.capabilities.flow.includes('text'));
});
