/* Real Chromium DOM, simulated providers. No signed-in AI service is exercised. */
const {chromium}=require('playwright');const assert=require('node:assert/strict');const path=require('node:path');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
 for(const provider of ['chatgpt','gemini']){
 const page=await browser.newPage();const origin=provider==='chatgpt'?'https://chatgpt.com':'https://gemini.google.com';
 await page.route(origin+'/**',route=>route.fulfill({contentType:'text/html',body:'<main><section>Old unrelated answer</section></main><form><textarea id="prompt-textarea"></textarea><input type="file" accept="video/*"><button type="button" aria-label="Send message">Send</button></form>'}));await page.goto(origin+(provider==='chatgpt'?'/c/test':'/app/test'));await page.clock.install();
 await page.evaluate(()=>{
  window.clicks=0;window.result=null;window.chrome={runtime:{id:'test',sendMessage:async()=>{},onMessage:{addListener:f=>window.handler=f}}};
  document.querySelector('input').onchange=event=>{const preview=document.createElement('div');preview.innerHTML='<span role="progressbar"></span><span></span>';preview.lastElementChild.textContent=event.target.files[0].name;document.querySelector('form').append(preview);};
  document.querySelector('button').onclick=()=>{
   clicks++;if(document.querySelector('[role="progressbar"]'))throw Error('Sent before upload completed');
   const prompt=document.querySelector('textarea').value;window.wirePrompt=prompt;document.querySelector('textarea').value='';
   const user=document.createElement('section');user.textContent=prompt;document.querySelector('main').append(user);
   const opening=prompt.match(/\[\[WF:[a-f0-9]+\]\]/)[0],closing=opening.replace('[[WF:','[[/WF:');
   const reply=document.createElement('section');reply.style.whiteSpace='pre-wrap';reply.textContent=opening+'\nPartial answer';document.querySelector('main').append(reply);
   setTimeout(()=>{reply.textContent=opening+'\nComplete script\nSecond paragraph\n'+closing;},12000);
  };
 });
 // Bridge must be installed before dispatching its request.
 await page.evaluate(()=>{window.startRequest=()=>handler({type:'WORKFLOW_AI_GENERATE',requestId:'auto',mediaType:'text',stageBeforeSend:false,prompt:'Analyze this video briefly.',referenceVideos:['data:video/mp4;base64,AQID']},{id:'test'},r=>window.result=r);});
 for(const file of ['composer-controls.js','ai-bridge.js'])await page.addScriptTag({path:path.resolve(__dirname,'../'+file)});
 await page.evaluate(()=>startRequest());await page.clock.runFor(5000);assert.equal(await page.evaluate(()=>clicks),0);assert.equal(await page.locator('[role="progressbar"]').count(),1);
 await page.evaluate(()=>document.querySelector('[role="progressbar"]').remove());await page.clock.runFor(6000);assert.equal(await page.evaluate(()=>clicks),1);assert.equal(await page.evaluate(()=>result),null,'Inline marker instructions in user prompt and incomplete response must not become a result');
 await page.clock.runFor(13000);const result=await page.evaluate(()=>result);assert.deepEqual(result,{ok:true,text:'Complete script\nSecond paragraph'});assert.equal(await page.evaluate(()=>clicks),1);await page.close();
 }
 console.log('PASS automatic GPT/Gemini text: waits for video upload, sends once without manual action, unique result markers survive unknown DOM, incomplete output waits, protocol stripped.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1});
