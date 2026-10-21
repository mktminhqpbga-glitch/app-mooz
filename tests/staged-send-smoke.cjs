const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  async function fixture(){
   const page=await browser.newPage();
   await page.route('https://chatgpt.com/**',r=>r.fulfill({contentType:'text/html',body:'<main></main><form><textarea id="prompt-textarea"></textarea><input type="file" accept="video/*"><button type="button" aria-label="Send message">Send</button></form>'}));
   await page.goto('https://chatgpt.com/c/chosen');await page.clock.install();
   await page.evaluate(()=>{
    window.sent=[];window.progress=[];window.chrome={runtime:{id:'test',sendMessage:async m=>progress.push(m.text),onMessage:{addListener:f=>window.handler=f}}};
    window.call=r=>new Promise(resolve=>handler(r,{id:'test'},resolve));
    document.querySelector('input').onchange=()=>{const preview=document.createElement('div');preview.className='attachment-preview';preview.innerHTML='<span role="progressbar"></span>video.mp4';document.querySelector('form').append(preview);};
    window.finishUpload=()=>document.querySelector('[role="progressbar"]')?.remove();
    document.querySelector('button').onclick=()=>{sent.push({text:document.querySelector('textarea').value,uploading:!!document.querySelector('[role="progressbar"]')});document.querySelector('textarea').value='';const reply=document.createElement('div');reply.dataset.messageAuthorRole='assistant';reply.textContent='Video analysis';document.querySelector('main').append(reply);};
    window.begin=()=>{window.result=null;call({type:'WORKFLOW_AI_GENERATE',requestId:'stage',mediaType:'text',stageBeforeSend:true,prompt:'Analyze original video',referenceVideos:['data:video/mp4;base64,AQID']}).then(r=>window.result=r);};
   });
   await page.addScriptTag({path:path.resolve(__dirname,'../composer-controls.js')});await page.addScriptTag({path:path.resolve(__dirname,'../ai-bridge.js')});await page.evaluate(()=>begin());
   for(let i=0;i<20;i++){await page.clock.runFor(100);if(await page.locator('[role="progressbar"]').count())break;}assert.equal(await page.locator('[role="progressbar"]').count(),1);return page;
  }
  const auto=await fixture();await auto.evaluate(()=>finishUpload());await auto.clock.runFor(1000);assert.equal(await auto.locator('textarea').inputValue(),'Analyze original video');await auto.clock.runFor(118000);assert.equal(await auto.evaluate(()=>sent.length),0);await auto.clock.runFor(7000);assert.equal((await auto.evaluate(()=>result)).ok,true);assert.deepEqual(await auto.evaluate(()=>sent),[{text:'Analyze original video',uploading:false}]);await auto.close();
  const early=await fixture();assert.equal((await early.evaluate(()=>call({type:'WORKFLOW_AI_SEND_NOW',requestId:'wrong'}))).ok,false);await early.evaluate(()=>call({type:'WORKFLOW_AI_SEND_NOW',requestId:'stage'}));await early.clock.runFor(10000);assert.equal(await early.evaluate(()=>sent.length),0);await early.evaluate(()=>finishUpload());await early.clock.runFor(6000);assert.equal((await early.evaluate(()=>result)).ok,true);assert.equal(await early.evaluate(()=>sent[0].uploading),false);await early.close();
  const changed=await fixture();await changed.evaluate(()=>finishUpload());await changed.clock.runFor(1000);await changed.evaluate(()=>history.pushState({},'', '/c/another'));await changed.clock.runFor(1000);assert.equal((await changed.evaluate(()=>result)).ok,false);assert.equal(await changed.evaluate(()=>sent.length),0);await changed.close();
  const stopped=await fixture();await stopped.evaluate(()=>finishUpload());await stopped.clock.runFor(1000);await stopped.evaluate(()=>call({type:'WORKFLOW_AI_STOP',requestId:'stage'}));await stopped.clock.runFor(125000);assert.equal(await stopped.evaluate(()=>sent.length),0);assert.equal((await stopped.evaluate(()=>result)).ok,false);await stopped.close();
  const manual=await fixture();await manual.evaluate(()=>finishUpload());await manual.clock.runFor(1000);await manual.evaluate(()=>document.querySelector('button').click());await manual.clock.runFor(125000);assert.equal(await manual.evaluate(()=>sent.length),1);assert.equal((await manual.evaluate(()=>result)).ok,true);await manual.close();
  console.log('PASS staged text: 120-second automatic send, early request waits for upload, manual send not duplicated, changed chat rejected, cancellation.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
