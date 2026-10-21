/* Provider DOM regression fixtures; not a signed-in ChatGPT session. */
const {chromium}=require('playwright');const assert=require('node:assert/strict');const path=require('node:path');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
 async function fixture(mode){
  const page=await browser.newPage();await page.route('https://chatgpt.com/**',route=>route.fulfill({contentType:'text/html',body:'<main><article data-turn="assistant"><div class="markdown">Old answer</div></article></main><form><textarea id="prompt-textarea"></textarea><button type="button" aria-label="Send message">Send</button></form>'}));await page.goto('https://chatgpt.com/c/chosen');await page.clock.install();
  await page.evaluate(mode=>{
   window.clicks=0;window.result=null;window.progress=[];window.chrome={runtime:{id:'test',sendMessage:async m=>progress.push(m.text),onMessage:{addListener:f=>window.handler=f}}};
   document.querySelector('button').onclick=()=>{
    clicks++;
    if(mode==='noop'){document.querySelector('main article').append(document.createTextNode(' history hydrated'));return;}
    if(mode==='echo'){const user=document.createElement('article');user.dataset.turn='user';user.textContent='Write the requested script';document.querySelector('main').append(user);}
    else document.querySelector('form').remove();
    setTimeout(()=>{
     const reply=document.createElement('article');reply.dataset.turn='assistant';reply.innerHTML='<div data-testid="writing-block"><header>Viết<button>Copy</button></header><div data-testid="writing-block-content" contenteditable="true" role="textbox" data-placeholder="Hỏi ChatGPT" data-is-streaming="true">First paragraph</div></div>';if(mode==='toolbar'){reply.removeAttribute('data-turn');reply.dataset.testid='conversation-turn-2';reply.querySelector('header button').dataset.testid='copy-turn-action-button';reply.querySelector('[data-testid="writing-block"]').removeAttribute('data-testid');reply.querySelector('[data-testid="writing-block-content"]').className='markdown';reply.querySelector('[data-testid="writing-block-content"]').removeAttribute('data-testid');}document.querySelector('main').append(reply);
     const stop=document.createElement('button');stop.dataset.testid='stop-button';stop.setAttribute('aria-label','Stop streaming');document.body.append(stop);
     setTimeout(()=>{reply.querySelector('[data-is-streaming]').textContent='Final complete script';reply.querySelector('[data-is-streaming]').removeAttribute('data-is-streaming');stop.remove();},10000);
    },mode==='delayed'?25000:1000);
   };
  },mode);
  for(const file of ['composer-controls.js','ai-bridge.js'])await page.addScriptTag({path:file==='ai-bridge.js'&&process.env.WORKFLOW_BRIDGE_PATH?process.env.WORKFLOW_BRIDGE_PATH:path.resolve(__dirname,'../'+file)});
  await page.evaluate(()=>handler({type:'WORKFLOW_AI_GENERATE',requestId:'reply',mediaType:'text',prompt:'Write the requested script'},{id:'test'},r=>window.result=r));return page;
 }
 for(const mode of ['writing','delayed','echo','toolbar']){
  const page=await fixture(mode);await page.clock.runFor(mode==='delayed'?30000:6000);assert.equal(await page.evaluate(()=>result),null,'Must keep waiting while writing is streaming');await page.clock.runFor(15000);const result=await page.evaluate(()=>result);assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.text,'Final complete script');assert.equal(await page.evaluate(()=>clicks),1);await page.close();
 }
 const noop=await fixture('noop');await noop.clock.runFor(95000);assert.equal((await noop.evaluate(()=>result)).ok,false);assert.equal(await noop.evaluate(()=>clicks),1);assert.ok(!(await noop.evaluate(()=>progress)).some(text=>text.startsWith('AI đã nhận')));await noop.close();
 console.log('PASS ChatGPT response: writing block without legacy author role, hidden composer, >15s start delay, exact user echo with retained draft, streaming completion, no-op send rejected without retry.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
