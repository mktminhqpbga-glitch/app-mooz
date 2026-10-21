const {chromium}=require('playwright');const assert=require('node:assert/strict');const path=require('node:path');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
 const page=await browser.newPage();await page.route('https://muse.ai/**',r=>r.fulfill({contentType:'text/html',body:'<main><section><p>history</p><button>Header</button></section><form><textarea>PRIVATE PROMPT</textarea><button type="button" id="unknown"><svg width="20" height="20"><path d="M1 3L8 1L7 8Z"/></svg></button><button type="button" aria-label="Upload file">+</button></form></main>'}));await page.goto('https://muse.ai/chat');await page.evaluate(()=>{window.sent=0;window.saved={};window.chrome={storage:{local:{set:async value=>Object.assign(saved,value)}}};document.querySelector('#unknown').onclick=()=>sent++;});
 for(const file of ['composer-controls.js','muse-support.js'])await page.addScriptTag({path:path.resolve(__dirname,'../'+file)});
 assert.ok(!(await page.evaluate(()=>JSON.stringify(WorkflowMuseSupport.diagnostics()))).includes('PRIVATE PROMPT'));
 await page.evaluate(()=>{window.binding=WorkflowMuseSupport.bindSend();});await page.click('#unknown');const result=await page.evaluate(()=>binding);assert.equal(result.ok,true);assert.equal(await page.evaluate(()=>sent),0,'Binding must consume the selecting click');
 assert.equal(await page.evaluate(()=>WorkflowComposer.findSend(document.querySelector('form'))?.id),'unknown');
 await page.evaluate(()=>document.querySelector('#unknown').disabled=true);assert.equal(await page.evaluate(()=>WorkflowComposer.findSend(document.querySelector('form'))),null);
 console.log('PASS Muse support: sanitized diagnostics, user-selected unknown button, selection does not submit, disabled target rejected.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
