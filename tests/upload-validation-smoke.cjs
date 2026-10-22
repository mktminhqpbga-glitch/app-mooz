const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  for(const host of ['chatgpt.com','gemini.google.com','muse.ai']){
   const page=await browser.newPage();
   await page.route(`https://${host}/**`,r=>r.fulfill({contentType:'text/html',body:'<main><section id="composer"><textarea id="prompt-textarea" placeholder="Message"></textarea><input type="file" accept="image/*"><button type="button" aria-label="Send message">Send</button></section></main>'}));
   await page.goto(`https://${host}/`);
   await page.evaluate(()=>{
    window.sent=0;window.uploads=[];
    window.chrome={runtime:{id:'test',sendMessage:async()=>{},onMessage:{addListener:f=>window.handler=f}}};
    window.call=request=>new Promise(resolve=>handler(request,{id:'test'},resolve));
    const canvas=document.createElement('canvas');canvas.width=canvas.height=16;canvas.getContext('2d').fillRect(0,0,16,16);window.png=canvas.toDataURL();
    document.querySelector('button').onclick=()=>sent++;
    document.querySelector('input').onchange=async e=>{
     uploads.push({type:e.target.files[0].type,name:e.target.files[0].name,bytes:[...new Uint8Array(await e.target.files[0].arrayBuffer())]});
     const card=document.createElement('div');card.className='attachment-container';card.dataset.status='error';card.setAttribute('role','alert');card.textContent='Upload failed: network unavailable';document.querySelector('#composer').append(card);
    };
   });
   await page.addScriptTag({path:path.resolve(__dirname,'../composer-controls.js')});
   const checks=await page.evaluate(async()=>{
    const bytes=await(await fetch(png)).arrayBuffer();
    const corrected=await WorkflowComposer.prepareImage(new Blob([bytes],{type:'application/octet-stream'}));
    const svg=new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="12" height="8"><rect width="12" height="8" fill="red"/></svg>'],{type:'image/svg+xml'});
    const converted=await WorkflowComposer.prepareImage(svg);
    let invalid='';try{await WorkflowComposer.prepareImage(new Blob([new Uint8Array([1,2,3])],{type:'image/png'}));}catch(e){invalid=e.message;}
    let large='';try{await WorkflowComposer.prepareImage(new Blob([new Uint8Array(21*1024*1024)],{type:'image/png'}));}catch(e){large=e.message;}
    // Old chat errors and ordinary draft text must not block new uploads.
    const old=document.createElement('div');old.setAttribute('role','alert');old.textContent='Upload failed in history';document.querySelector('main').prepend(old);
    const ok=document.createElement('div');ok.setAttribute('role','alert');ok.textContent='File added';document.querySelector('#composer').append(ok);WorkflowComposer.assertUpload(document.querySelector('#composer'));ok.remove();
    return {type:corrected.type,preserved:JSON.stringify([...new Uint8Array(await corrected.arrayBuffer())])===JSON.stringify([...new Uint8Array(bytes)]),converted:converted.type,invalid,large};
   });
   assert.equal(checks.type,'image/png');assert.equal(checks.preserved,true);assert.equal(checks.converted,'image/png');assert.match(checks.invalid,/Không giải mã/);assert.match(checks.large,/20 MB/);
   await page.addScriptTag({path:path.resolve(__dirname,host==='muse.ai'?'../muse-bridge.js':'../ai-bridge.js')});
   const result=await page.evaluate(isMuse=>call({type:isMuse?'MUSEFLOW_GENERATE':'WORKFLOW_AI_GENERATE',requestId:'upload-error',mediaType:'image',prompt:'Create image',referenceImages:[png]}),host==='muse.ai');
   assert.equal(result.ok,false,JSON.stringify(result));assert.match(result.error,/Upload failed/);assert.match(result.error,/chưa được gửi/);assert.equal(await page.evaluate(()=>sent),0);assert.equal(await page.evaluate(()=>uploads.length),1,'Failed upload must never be retried automatically');
   await page.close();
  }
  console.log('PASS all three bridges: image bytes validated, MIME corrected without changing supported bytes, SVG converted to PNG, corrupt/oversized images rejected, composer upload errors stop before Send, history errors ignored, no automatic retry.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
