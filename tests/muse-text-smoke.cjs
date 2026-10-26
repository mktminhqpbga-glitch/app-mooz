/* Muse DOM fixtures: no authenticated account or AI generation. */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
 async function fixture(mode){
  const page=await browser.newPage();await page.route('https://muse.ai/**',r=>r.fulfill({contentType:'text/html',body:'<main><section id="thread"><div data-message-author-role="assistant">Old answer</div></section><form><textarea placeholder="Message"></textarea><input type="file" accept="image/*,video/*"><button type="button" aria-label="Send">Send</button></form></main>'}));await page.goto('https://muse.ai/chat/current');await page.clock.install();
  await page.evaluate(mode=>{window.listeners=[];window.sent=0;window.result=null;window.chrome={runtime:{id:'test',sendMessage:async()=>{},onMessage:{addListener:f=>listeners.push(f)}}};window.call=r=>new Promise(resolve=>{for(const f of listeners)f(r,{id:'test'},resolve);});
   document.querySelector('input').onchange=()=>{const preview=document.createElement('div');preview.dataset.testid='attachment-upload';preview.innerHTML='<span role="progressbar"></span><video src="data:video/mp4;base64,AQID"></video>';document.querySelector('form').append(preview);setTimeout(()=>preview.querySelector('span').remove(),2000);};
   document.querySelector('button').onclick=()=>{sent++;const box=document.querySelector('textarea'),receipt=document.createElement('div');receipt.dataset.messageAuthorRole='user';receipt.style.display='contents';const content=document.createElement('p');content.textContent=box.value;receipt.append(content);document.querySelector('#thread').append(receipt);box.value='';document.querySelectorAll('form [data-testid]').forEach(x=>x.remove());
    const group=document.createElement('div');group.className='group/msg';document.querySelector('#thread').append(group);const reply=document.createElement('div');reply.className='hatch-chat-groupable-bubble';reply.textContent='Partial';reply.dataset.isStreaming='true';group.append(reply);
    const stop=document.createElement('button');stop.dataset.testid='hatch-composer-stop-button';stop.textContent='Stop';document.body.append(stop);
    if(mode==='cancel')return;setTimeout(()=>{reply.innerHTML='<p>Complete current answer.</p><p>Second paragraph.</p><button>Copy</button>';reply.removeAttribute('data-is-streaming');stop.remove();},9000);
   };
  },mode);
  for(const file of ['ai-activity.js','composer-controls.js','muse-bridge.js'])await page.addScriptTag({path:path.resolve(__dirname,'../'+file)});
  return page;
 }
 for(const mode of ['text','video','delay','cancel','switch','manual']){
  const page=await fixture(mode);assert.equal((await page.evaluate(()=>call({type:'MUSEFLOW_CHECK_SESSION'}))).textProtocol,1);
  await page.evaluate(mode=>{void call({type:'MUSEFLOW_JOB_START',requestId:'text-job',mediaType:'text',prompt:'Write a complete script for this product',rules:'Return plain text',stageBeforeSend:mode==='delay'||mode==='manual',referenceVideos:mode==='video'?['data:video/mp4;base64,AQID']:[]});},mode);
  await page.clock.runFor(5000);
  if(mode==='delay'){assert.equal(await page.evaluate(()=>sent),0);await page.evaluate(()=>call({type:'WORKFLOW_AI_SEND_NOW',requestId:'text-job'}));await page.clock.runFor(1000);}
  if(mode==='manual'){await page.evaluate(()=>call({type:'WORKFLOW_AI_USE_RESULT',requestId:'text-job',text:'Manual result'}));await page.clock.runFor(1000);assert.equal((await page.evaluate(()=>call({type:'MUSEFLOW_JOB_STATUS',requestId:'text-job'}))).result.text,'Manual result');}
  else if(mode==='cancel'){await page.evaluate(()=>call({type:'MUSEFLOW_STOP_GENERATION',requestId:'text-job'}));await page.clock.runFor(500);assert.equal((await page.evaluate(()=>call({type:'MUSEFLOW_JOB_STATUS',requestId:'text-job'}))).result.ok,false);}
  else if(mode==='switch'){await page.evaluate(()=>history.pushState({},'','/chat/different'));await page.clock.runFor(1000);assert.match((await page.evaluate(()=>call({type:'MUSEFLOW_JOB_STATUS',requestId:'text-job'}))).result.error,/đã thay đổi/);}
  else{for(let i=0;i<12;i++){await page.clock.runFor(2000);if((await page.evaluate(()=>call({type:'MUSEFLOW_JOB_STATUS',requestId:'text-job'}))).state==='done')break;}const state=await page.evaluate(()=>call({type:'MUSEFLOW_JOB_STATUS',requestId:'text-job'}));assert.equal(state.state,'done',JSON.stringify(state));assert.equal(state.result.text,'Complete current answer.\nSecond paragraph.');}
  assert.equal(await page.evaluate(()=>sent),mode==='manual'?0:1);await page.close();console.log('PASS Muse text '+mode+': current receipt, complete text, one send.');
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
