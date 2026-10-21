/* Real DOM upload/send simulation; provider selectors still require live-account QA. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage();
  await page.route('https://gemini.google.com/**',route=>route.fulfill({contentType:'text/html',body:'<main><form><rich-textarea><div contenteditable="true">old draft</div></rich-textarea><input type="file" accept="image/*,video/*"><div class="attachment-container">old file<button type="button" aria-label="Remove attachment">X</button></div><button type="button" aria-label="Send message">Send</button></form></main>'}));
  await page.goto('https://gemini.google.com/app');
  await page.evaluate(()=>{
   window.messages=[];window.sent=[];window.uploads=[];
   window.chrome={runtime:{id:'test',onMessage:{addListener:fn=>window.handler=fn}}};
   const form=document.querySelector('form'),button=form.querySelector('[aria-label="Send message"]');
   form.querySelector('[aria-label="Remove attachment"]').onclick=e=>e.target.parentElement.remove();
   form.querySelector('input').onchange=async e=>{
    const file=e.target.files[0];uploads.push({type:file.type,bytes:[...new Uint8Array(await file.arrayBuffer())]});
    const attachment=document.createElement('div');attachment.className='attachment-container';attachment.innerHTML='<span role="progressbar"></span><button type="button" aria-label="Remove attachment">X</button>';attachment.querySelector('button').onclick=()=>attachment.remove();form.append(attachment);button.disabled=true;
    setTimeout(()=>{attachment.querySelector('span').remove();button.disabled=false;},300);
   };
   button.onclick=()=>{
    sent.push({text:form.querySelector('[contenteditable]').innerText,attachments:form.querySelectorAll('.attachment-container').length,uploading:!!form.querySelector('[role="progressbar"]')});
    form.querySelector('[contenteditable]').replaceChildren();form.querySelectorAll('.attachment-container').forEach(el=>el.remove());
    const reply=document.createElement('model-response');reply.textContent='Kịch bản mới '+sent.length;document.querySelector('main').append(reply);
   };
   window.call=request=>new Promise(resolve=>handler(request,{id:'test'},resolve));
  });
  await page.addScriptTag({path:require('node:path').resolve(__dirname,'../ai-bridge.js')});
  for(let i=0;i<2;i++){
   const result=await page.evaluate(async i=>call({type:'WORKFLOW_AI_GENERATE',requestId:'r'+i,mediaType:'text',prompt:'Phân tích video '+i,...(i===0?{referenceVideos:['data:video/mp4;base64,AQID']}:{referenceImages:['data:image/png;base64,AQID']})}),i);
   assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.text,'Kịch bản mới '+(i+1));
  }
  const data=await page.evaluate(()=>({sent,uploads}));
  assert.equal(data.sent.length,2);assert.ok(data.sent.every(s=>s.attachments===1&&!s.uploading&&!s.text.includes('old draft')));assert.deepEqual(data.uploads,[{type:'video/mp4',bytes:[1,2,3]},{type:'image/png',bytes:[1,2,3]}]);
  // Cancellation interrupts reply polling and does not submit another prompt.
  await page.evaluate(()=>{document.querySelector('[aria-label="Send message"]').onclick=()=>{sent.push({text:'cancel'});document.querySelector('[contenteditable]').replaceChildren();window.stopClicks=0;const stop=document.createElement('button');stop.type='button';stop.setAttribute('aria-label','Stop response');stop.onclick=()=>{stopClicks++;stop.remove();};document.body.appendChild(stop);};});
  const pending=page.evaluate(()=>call({type:'WORKFLOW_AI_GENERATE',requestId:'cancel',mediaType:'text',prompt:'Stop me'}));
  await page.waitForFunction(()=>sent.length===3);const unknown=await page.evaluate(()=>call({type:'WORKFLOW_AI_STOP',requestId:'unrelated'}));assert.equal(unknown.stopped,false);assert.equal(await page.evaluate(()=>stopClicks),0);await page.evaluate(()=>call({type:'WORKFLOW_AI_STOP',requestId:'cancel'}));assert.equal((await pending).ok,false);assert.equal(await page.evaluate(()=>stopClicks),1);
  const gpt=await browser.newPage();
  await gpt.route('https://chatgpt.com/**',route=>route.fulfill({contentType:'text/html',body:'<form><textarea id="prompt-textarea"></textarea><button type="button" data-testid="send-button">Send</button></form><main></main>'}));await gpt.goto('https://chatgpt.com/');
  await gpt.evaluate(()=>{window.sent=0;window.kind='text';window.chrome={runtime:{id:'test',onMessage:{addListener:fn=>window.handler=fn}}};window.call=request=>new Promise(resolve=>handler(request,{id:'test'},resolve));document.querySelector('button').onclick=()=>{sent++;document.querySelector('textarea').value='';const reply=document.createElement('div');reply.setAttribute('data-message-author-role','assistant');if(kind==='image'){const canvas=document.createElement('canvas');canvas.width=canvas.height=256;canvas.getContext('2d').fillRect(0,0,256,256);const img=new Image();img.src=canvas.toDataURL();reply.appendChild(img);}else reply.textContent='ChatGPT response';document.querySelector('main').appendChild(reply);};});
  await gpt.addScriptTag({path:require('node:path').resolve(__dirname,'../ai-bridge.js')});
  const text=await gpt.evaluate(()=>call({type:'WORKFLOW_AI_GENERATE',requestId:'gpt-text',mediaType:'text',prompt:'Write text'}));assert.equal(text.text,'ChatGPT response');
  await gpt.evaluate(()=>{kind='image';});const image=await gpt.evaluate(()=>call({type:'WORKFLOW_AI_GENERATE',requestId:'gpt-image',mediaType:'image',prompt:'Draw image'}));assert.equal(image.ok,true);assert.ok(image.url.startsWith('data:image/png;base64,'));
  const unsupported=await gpt.evaluate(()=>call({type:'WORKFLOW_AI_GENERATE',requestId:'gpt-video',mediaType:'text',prompt:'Read video',referenceVideos:['data:video/mp4;base64,AQID']}));assert.equal(unsupported.ok,false);assert.equal(await gpt.evaluate(()=>sent),2);
  assert.equal(await gpt.evaluate(()=>handler({type:'WORKFLOW_AI_GENERATE'},{id:'untrusted'},()=>{})),false);
  console.log('PASS ChatGPT DOM: native textarea, new text/image results, persisted image bytes, video rejected before send, untrusted sender rejected.');
  console.log('PASS bridge DOM: clears old draft/attachments, transports original video, waits for upload completion, sends once, captures new reply, reruns cleanly, cancels.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
