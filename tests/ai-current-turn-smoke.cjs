/* Browser DOM/CDN fixtures, not authenticated provider sessions. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  for(const provider of ['gemini','chatgpt'])for(const kind of ['text','image']){
   const page=await browser.newPage(),host=provider==='gemini'?'gemini.google.com':'chatgpt.com';
   await page.route('https://'+host+'/**',r=>r.fulfill({contentType:'text/html',body:`<main id="thread"><div ${provider==='gemini'?'class="model-response"':'data-turn="assistant"'}>Old answer</div></main><form><textarea ${provider==='chatgpt'?'id="prompt-textarea"':''} placeholder="Message"></textarea><button type="button" aria-label="Send">Send</button></form>`}));
   await page.goto('https://'+host+(provider==='gemini'?'/app':'/'));await page.clock.install();
   await page.evaluate(({provider,kind})=>{
    window.handlers=[];window.sent=0;window.result=null;window.fetches=[];
    window.chrome={runtime:{id:'test',sendMessage:async()=>{},onMessage:{addListener:f=>handlers.push(f)}}};
    window.call=req=>new Promise(resolve=>{for(const handler of handlers)handler(req,{id:'test'},resolve);});
    const canvas=document.createElement('canvas');canvas.width=288;canvas.height=512;canvas.getContext('2d').fillStyle='blue';canvas.getContext('2d').fillRect(0,0,288,512);window.expected=canvas.toDataURL();
    const originalFetch=fetch;window.fetch=async(url,options)=>{
     if(url==='https://fixture-cdn.invalid/result.png'){
      fetches.push(options.credentials);
      if(options.credentials==='include')throw new TypeError('Failed to fetch (credentialed CORS)');
      if(fetches.length<4)return new Response('Pending',{status:503});
      return originalFetch(expected);
     }return originalFetch(url,options);
    };
    document.querySelector('button').onclick=()=>{
     sent++;const editor=document.querySelector('textarea'),wire=editor.value;
     // Gemini wraps a truncated user echo twice. The full prompt is not in DOM.
     const user=document.createElement(provider==='gemini'?'user-query':'article');
     if(provider==='chatgpt')user.dataset.turn='user';
     const body=document.createElement('div');if(provider==='gemini')body.className='user-query-container';
     body.textContent=provider==='gemini'?window.promptText.slice(0,190)+'…':wire;user.append(body);document.querySelector('main').append(user);editor.value='';
     history.pushState({},'',provider==='gemini'?'/app/current-request':'/c/current-request');
     const reply=document.createElement('div');if(provider==='gemini')reply.className='model-response';else reply.dataset.turn='assistant';reply.id='current';reply.setAttribute('data-is-streaming','true');document.querySelector('main').append(reply);
     const markers=[...wire.matchAll(/\[\[\/?WF:[a-f0-9]+\]\]/g)].map(m=>m[0]);
     if(kind==='text'){
      // Complete markers cannot bypass the provider's streaming state.
      reply.textContent=markers[0]+'\nPartial answer\n'+markers[1];
      setTimeout(()=>{reply.textContent=markers[0]+'\nCorrect current answer\n'+markers[1];reply.removeAttribute('data-is-streaming');},9000);
     }else{
      const img=new Image();img.src='https://fixture-cdn.invalid/result.png';Object.defineProperty(img,'naturalWidth',{get:()=>288});Object.defineProperty(img,'naturalHeight',{get:()=>512});reply.append(img);reply.removeAttribute('data-is-streaming');
     }
    };
    window.promptText='Create a complete description of the current product and its verified characteristics. '.repeat(8);
   },{provider,kind});
   for(const file of ['ai-activity.js','composer-controls.js','ai-bridge.js'])await page.addScriptTag({path:path.resolve(__dirname,'../'+file)});
   await page.evaluate(kind=>{void call({type:'WORKFLOW_AI_GENERATE',requestId:'current',mediaType:kind,prompt:promptText}).then(r=>result=r);},kind);
   await page.clock.runFor(6500);assert.equal(await page.evaluate(()=>result),null,provider+' must await stream/CDN readiness');
   await page.clock.runFor(16000);await page.waitForFunction(()=>result!==null);
   const result=await page.evaluate(()=>window.result);assert.equal(result.ok,true,JSON.stringify(result));
   if(kind==='text')assert.equal(result.text,'Correct current answer');
   else {assert.equal(await page.evaluate(()=>result.url===expected),true);assert.ok(await page.evaluate(()=>fetches.length>=4),'Transient failures retry reading, not generating');}
   assert.equal(await page.evaluate(()=>sent),1);
   const check=await page.evaluate(()=>call({type:'WORKFLOW_AI_CHECK'}));assert.equal(check.resultProtocol,3);assert.equal(check.lastScan.current,1);
   assert.ok(!JSON.stringify(check.lastScan).includes('product'));
   // Existing chat switches must fail instead of returning a different chat's answer.
   await page.evaluate(()=>{result=null;document.querySelector('button').onclick=()=>{sent++;document.querySelector('textarea').value='';history.pushState({},'','/other-chat');const reply=document.createElement('div');reply.dataset.turn='assistant';reply.className='model-response';reply.textContent='Wrong conversation answer';document.querySelector('main').append(reply);};void call({type:'WORKFLOW_AI_GENERATE',requestId:'switch',mediaType:'text',prompt:'Different prompt'}).then(r=>result=r);});
   await page.clock.runFor(6000);assert.equal((await page.evaluate(()=>result)).ok,false);assert.match((await page.evaluate(()=>result)).error,/Cuộc trò chuyện đã thay đổi/);
   await page.close();console.log('PASS '+provider+' '+kind+': new chat URL, collapsed/nested user echo, scoped streaming result, retryable CDN CORS, existing-chat switch rejected, one send.');
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
