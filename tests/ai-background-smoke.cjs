/* Chrome offscreen/background fixtures; provider responses and throttling are simulated. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 const headed=!!process.env.DISPLAY,browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:!headed,args:['--no-sandbox']});
 try{
  for(const [provider,kind] of [['gemini','image'],['muse','image'],['gemini','text'],['chatgpt','text']].filter(([provider])=>!process.env.AI_BACKGROUND_PROVIDER||provider===process.env.AI_BACKGROUND_PROVIDER)){
   const context=await browser.newContext(),page=await context.newPage(),host={gemini:'gemini.google.com',muse:'muse.ai',chatgpt:'chatgpt.com'}[provider];
   await page.route('https://'+host+'/**',r=>r.fulfill({contentType:'text/html',body:'<main><section id="thread"></section><form><textarea placeholder="Message"></textarea><button type="button" aria-label="Send">Send</button></form></main>'}));await page.goto('https://'+host+'/');
   await page.evaluate(({provider})=>{
    window.listeners=[];window.sent=0;window.result=null;window.events=[];
    window.chrome={runtime:{id:'test',sendMessage:async m=>events.push(m.type),onMessage:{addListener:f=>listeners.push(f)}}};
    window.call=req=>new Promise(resolve=>{for(const listener of listeners)listener(req,{id:'test'},resolve);});
    const canvas=document.createElement('canvas');canvas.width=288;canvas.height=512;canvas.getContext('2d').fillStyle='blue';canvas.getContext('2d').fillRect(0,0,288,512);window.expected=canvas.toDataURL();
    document.querySelector('button').onclick=()=>{
     sent++;const input=document.querySelector('textarea'),user=document.createElement(provider==='gemini'?'user-query':'div');if(provider!=='gemini')user.dataset.messageAuthorRole='user';user.textContent=input.value;input.value='';document.querySelector('#thread').append(user);
     const response=document.createElement(provider==='gemini'?'model-response':'div');response.id='response';if(provider==='muse')response.className='hatch-chat-groupable-bubble';else if(provider==='chatgpt')response.dataset.messageAuthorRole='assistant';response.setAttribute('aria-busy','true');document.querySelector('#thread').append(response);
    };
   },{provider});
   for(const file of ['ai-activity.js','composer-controls.js',provider==='muse'?'muse-bridge.js':'ai-bridge.js'])await page.addScriptTag({path:path.resolve(__dirname,'../'+file)});
   await page.evaluate(({provider,kind})=>{void call({type:provider==='muse'?'MUSEFLOW_GENERATE':'WORKFLOW_AI_GENERATE',requestId:'hidden-'+provider+'-'+kind,mediaType:kind,prompt:'Create the current result',size:'9:16',timeoutSec:30}).then(r=>window.result=r);},{provider,kind});
   for(let i=0;i<100&&!(await page.evaluate(()=>sent));i++)await pause(20);assert.equal(await page.evaluate(()=>sent),1);
   // Playwright normally emulates every page as focused/active. Disable that
   // emulation before checking real background visibility.
   const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:false});
   const foreground=await context.newPage();await foreground.goto('about:blank');await foreground.bringToFront();
   if(headed)assert.equal(await page.evaluate(()=>document.hasFocus()),false,'The AI page must be unfocused');
   // Freeze in-page timers and layout to represent throttled/offscreen collection.
   await page.evaluate(({kind})=>{
    // Playwright keeps visibility emulated as visible; emulate hidden state too.
    Object.defineProperty(document,'hidden',{get:()=>true});Object.defineProperty(document,'visibilityState',{get:()=>'hidden'});
    window.setTimeout=()=>0;window.clearTimeout=()=>{};
    const rects=Element.prototype.getClientRects;Element.prototype.getClientRects=function(){return this.closest?.('#thread')?[]:rects.call(this);};
    const reply=document.querySelector('#response');reply.setAttribute('aria-busy','false');
    if(kind==='image'){const image=new Image();image.loading='lazy';image.src=expected;Object.defineProperty(image,'naturalWidth',{get:()=>0});Object.defineProperty(image,'naturalHeight',{get:()=>0});reply.append(image);}
    else reply.innerHTML='<p>Kết quả đang ở nền</p><p>Dòng thứ hai</p><span style="display:none">Old hidden content</span><button>Copy</button>';
   },{kind});
   const deadline=Date.now()+12000;
   while(Date.now()<deadline&&!(await page.evaluate(()=>result))){await page.evaluate(()=>call({type:'WORKFLOW_AI_PULSE'}));await pause(120);}
   if(!(await page.evaluate(()=>result)))console.log(await page.evaluate(()=>({visibility:document.visibilityState,focused:document.hasFocus(),diagnostics:globalThis.WorkflowMuseBridgeDiagnostics?.(),events})));
   assert.equal(await page.evaluate(()=>result?.ok),true,provider+' '+kind+' must complete without foreground activation');
   if(kind==='image')assert.equal(await page.evaluate(()=>result.url===expected),true);else assert.equal(await page.evaluate(()=>result.text),'Kết quả đang ở nền\nDòng thứ hai');
   assert.equal(await page.evaluate(()=>sent),1);assert.equal(await page.evaluate(()=>events.includes('WORKFLOW_AI_WATCH_START')&&events.includes('WORKFLOW_AI_WATCH_END')),true);
   if(headed){assert.equal(await page.evaluate(()=>document.hidden),true,'Collection must not activate the AI tab');assert.equal(await foreground.evaluate(()=>document.hidden),false);}
   const sendsBeforeStop=await page.evaluate(()=>sent);
   await page.evaluate(({provider,kind})=>{window.stoppedResult=null;void call({type:provider==='muse'?'MUSEFLOW_GENERATE':'WORKFLOW_AI_GENERATE',requestId:'cancel-hidden',mediaType:kind,prompt:'Cancel this background request',size:'9:16'}).then(r=>window.stoppedResult=r);},{provider,kind});
   await page.evaluate(provider=>call({type:provider==='muse'?'MUSEFLOW_STOP_GENERATION':'WORKFLOW_AI_STOP',requestId:'cancel-hidden'}),provider);
   for(let i=0;i<20&&!(await page.evaluate(()=>stoppedResult));i++){await page.evaluate(()=>call({type:'WORKFLOW_AI_PULSE'}));await pause(30);}
   assert.equal(await page.evaluate(()=>stoppedResult?.ok),false,'Stop must settle even when background timers are frozen');
   assert.ok(await page.evaluate(before=>sent<=before+1,sendsBeforeStop));
   assert.equal(await page.evaluate(()=>events.filter(type=>type==='WORKFLOW_AI_WATCH_END').length),2,'Both successful and stopped requests release their activity lease');
   await context.close();console.log('PASS background '+provider+' '+kind+': '+(headed?'unfocused browser tab':'headless fixture')+', simulated hidden visibility/frozen timers, no response layout, lazy image metadata, no focus, one send.');
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
