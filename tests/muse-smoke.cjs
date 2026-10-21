const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage();
  await page.route('https://muse.ai/**',route=>route.fulfill({contentType:'text/html',body:'<main><div data-message-author-role="user"><div class="attachment-container">History file<button type="button" aria-label="Remove attachment">X</button><button type="button" aria-label="Send old">Old send</button></div></div><section id="composer"><textarea placeholder="Message">old draft</textarea><input type="file" accept="image/*"><button type="button" aria-label="Send" data-testid="hatch-composer-send-button">Send</button></section></main>'}));await page.goto('https://muse.ai/');
  await page.evaluate(()=>{
   window.sent=[];window.wrongClicks=0;window.refuse=false;
   window.chrome={runtime:{id:'test',onMessage:{addListener:fn=>window.handler=fn}}};window.call=req=>new Promise(resolve=>handler(req,{id:'test'},resolve));
   document.querySelectorAll('[data-message-author-role="user"] button').forEach(b=>b.onclick=()=>wrongClicks++);
   const scope=document.querySelector('#composer'),canvas=document.createElement('canvas');canvas.width=canvas.height=256;canvas.getContext('2d').fillRect(0,0,256,256);const png=canvas.toDataURL();window.reference=png;
   scope.querySelector('input').onchange=()=>{const preview=document.createElement('img');preview.className='image-preview';preview.src=png;scope.append(preview);const old=scope.querySelector('textarea');const fresh=old.cloneNode();fresh.value='';old.replaceWith(fresh);};
   scope.querySelector('button').onclick=()=>{sent.push(scope.querySelector('textarea').value);scope.querySelector('textarea').value='';scope.querySelectorAll('img').forEach(img=>img.remove());const bubble=document.createElement('div');bubble.className='hatch-chat-groupable-bubble';bubble.setAttribute('data-message-author-role','assistant');if(refuse)bubble.textContent='I cannot create this content.';else{const attachment=document.createElement('div');attachment.setAttribute('data-testid','hatch-chat-attachment-presentation-'+crypto.randomUUID());const img=new Image();img.src=png;attachment.append(img);bubble.append(attachment);}document.querySelector('main').append(bubble);};
  });
  await page.addScriptTag({path:require('node:path').resolve(__dirname,'../muse-bridge.js')});
  const result=await page.evaluate(()=>call({type:'MUSEFLOW_GENERATE',requestId:'muse-image',prompt:'Create image',mediaType:'image',referenceImages:[reference]}));assert.equal(result.ok,true,JSON.stringify(result));assert.ok(result.url.startsWith('data:image/png'));assert.deepEqual(await page.evaluate(()=>sent),['Create image']);assert.equal(await page.evaluate(()=>wrongClicks),0);
  await page.evaluate(()=>{refuse=true;});const refusal=await page.evaluate(()=>call({type:'MUSEFLOW_GENERATE',requestId:'muse-refusal',prompt:'Create another image',mediaType:'image'}));assert.equal(refusal.ok,false);assert.equal(refusal.code,'SCENE_REFUSED');assert.equal(await page.evaluate(()=>wrongClicks),0);
  console.log('PASS Muse DOM: chat history untouched, composer-local Send, upload rerender, exact prompt submitted once, image response and refusal handled.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
