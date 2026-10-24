const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  try{
    const page=await browser.newPage();
    await page.route('https://gemini.google.com/**',r=>r.fulfill({contentType:'text/html',body:'<main><section id="thread"><model-response id="history">Previous image<img></model-response><model-response id="reused">Image ready<img></model-response></section><form><rich-textarea><div contenteditable="true" role="textbox"></div></rich-textarea><input type="file" accept="image/*"><button type="button" aria-label="Send">Send</button></form></main>'}));
    await page.goto('https://gemini.google.com/app/result-test');await page.clock.install();
    await page.evaluate(()=>{
      window.sent=0;window.result=null;window.progress=[];
      window.chrome={runtime:{id:'test',sendMessage:async m=>progress.push(m.text),onMessage:{addListener:f=>window.handler=f}}};
      const png=(color,w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').fillStyle=color;c.getContext('2d').fillRect(0,0,w,h);return c.toDataURL();};
      document.querySelector('#history img').src=png('red',128,128);document.querySelector('#reused img').src=png('yellow',256,256);
      window.reference=png('brown',447,447);window.expected=png('blue',288,512);window.oldFull=png('red',447,447);
      document.querySelector('input').onchange=()=>{const card=document.createElement('div');card.className='attachment-container';const img=new Image();img.src=reference;card.append(img);document.querySelector('form').append(card);};
      document.querySelector('button').onclick=()=>{
        sent++;const editor=document.querySelector('[contenteditable]'),user=document.createElement('user-query');user.textContent=editor.innerText;editor.replaceChildren();document.querySelector('#thread').append(user);
        document.querySelectorAll('form .attachment-container').forEach(el=>el.remove());
        const history=document.querySelector('#history'),clone=history.cloneNode(true);clone.querySelector('img').src=oldFull;history.replaceWith(clone);
        const reused=document.querySelector('#reused');document.querySelector('#thread').append(reused);
        // Gemini reuses its model-response element and text while image bytes change.
        reused.querySelector('img').src=URL.createObjectURL(document.querySelector('input').files[0]);
        setTimeout(()=>{reused.querySelector('img').src=expected;},10000);
      };
    });
    for(const file of ['ai-activity.js','composer-controls.js','ai-bridge.js'])await page.addScriptTag({path:path.resolve(__dirname,'../'+file)});
    await page.evaluate(()=>handler({type:'WORKFLOW_AI_GENERATE',requestId:'gemini-current-image',mediaType:'image',prompt:'Create a full body portrait from this reference',size:'9:16',referenceImages:[reference]},{id:'test'},r=>window.result=r));
    for(let i=0;i<50&&!(await page.evaluate(()=>sent));i++)await page.clock.runFor(200);
    assert.equal(await page.evaluate(()=>sent),1);
    await page.clock.runFor(7500);
    assert.equal(await page.evaluate(()=>result===null),true,'Do not return refreshed history or the echoed reference');
    await page.clock.runFor(8000);await page.waitForFunction(()=>result!==null,{},{timeout:5000});
    assert.equal(await page.evaluate(()=>result?.ok),true);
    assert.equal(await page.evaluate(()=>result.url===expected),true,'Read the new image even when the reply wrapper and text are unchanged');
    assert.equal(await page.evaluate(()=>sent),1);
    console.log('PASS Gemini image association: refreshed history and reference echo rejected; new portrait read from reused response with unchanged text; sent once.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
