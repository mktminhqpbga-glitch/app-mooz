const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');

(async()=>{
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  try{
    const page=await browser.newPage();
    await page.route('https://muse.ai/**',r=>r.fulfill({contentType:'text/html',body:'<main><section id="thread"><article id="old"><div data-message-author-role="user">Create the next portrait image</div><div data-message-author-role="assistant"><img id="previous-image"></div></article></section><form><textarea placeholder="Message"></textarea><button type="button" aria-label="Send">Send</button></form></main>'}));
    await page.goto('https://muse.ai/association');
    await page.clock.install();
    await page.evaluate(()=>{
      window.sends=0;window.reply=null;window.progress=[];
      window.chrome={runtime:{id:'test',sendMessage:async m=>progress.push(m.text),onMessage:{addListener:f=>window.handler=f}}};
      const png=(color,w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').fillStyle=color;c.getContext('2d').fillRect(0,0,w,h);return c.toDataURL();};
      document.querySelector('#previous-image').src=png('red',128,128);
      window.oldFull=png('red',447,447);window.expected=png('blue',288,512);
      document.querySelector('button').onclick=()=>{
        sends++;const editor=document.querySelector('textarea'),receipt=document.createElement('div');receipt.dataset.messageAuthorRole='user';receipt.textContent=editor.value;editor.value='';document.querySelector('#thread').append(receipt);
        // Rehydrated history gets both a new container and a new image URL.
        const history=document.querySelector('#old').cloneNode(true);history.removeAttribute('id');history.querySelector('img').src=oldFull;document.querySelector('#old').replaceWith(history);
        setTimeout(()=>{const response=document.createElement('div');response.dataset.messageAuthorRole='assistant';const image=new Image();image.src=expected;response.append(image);document.querySelector('#thread').append(response);},9000);
      };
    });
    for(const file of ['composer-controls.js','muse-bridge.js'])await page.addScriptTag({path:path.resolve(__dirname,'../'+file)});
    await page.evaluate(()=>handler({type:'MUSEFLOW_GENERATE',requestId:'late-history',prompt:'Create the next portrait image',mediaType:'image',size:'9:16',timeoutSec:30},{id:'test'},r=>window.reply=r));
    await page.clock.runFor(7000);
    assert.equal(await page.evaluate(()=>reply===null),true,'A rehydrated previous image must not finish the current request');
    await page.clock.runFor(6000);
    assert.equal(await page.evaluate(()=>reply?.ok),true);
    assert.equal(await page.evaluate(()=>reply.url),await page.evaluate(()=>expected));
    assert.equal(await page.evaluate(()=>sends),1);
    // Muse's generic visual bubble also wraps the user's sent reference photos.
    // Their fresh blob URLs must never win before the real assistant image arrives.
    await page.evaluate(()=>{
      window.reply=null;
      document.querySelector('button').onclick=()=>{
        sends++;const editor=document.querySelector('textarea');
        const user=document.createElement('div');user.className='hatch-chat-groupable-bubble';
        const text=document.createElement('span');text.textContent=editor.value;editor.value='';user.append(text);
        const c=document.createElement('canvas');c.width=c.height=447;c.getContext('2d').fillStyle='green';c.getContext('2d').fillRect(0,0,447,447);
        for(let i=0;i<4;i++){const image=new Image();image.src=c.toDataURL();user.append(image);}
        document.querySelector('#thread').append(user);
        setTimeout(()=>{const reply=document.createElement('div');reply.className='hatch-chat-groupable-bubble';const image=new Image(),c=document.createElement('canvas');c.width=288;c.height=512;c.getContext('2d').fillStyle='purple';c.getContext('2d').fillRect(0,0,288,512);image.src=window.expected=c.toDataURL();reply.append(image);document.querySelector('#thread').append(reply);},9000);
      };
      handler({type:'MUSEFLOW_GENERATE',requestId:'reference-echo',prompt:'Keep the person and use all four references',mediaType:'image',size:'9:16',timeoutSec:30},{id:'test'},r=>window.reply=r);
    });
    await page.clock.runFor(7000);
    assert.equal(await page.evaluate(()=>reply===null),true,'The sent reference photos are not generated results');
    await page.clock.runFor(6000);
    assert.equal(await page.evaluate(()=>reply?.ok),true);
    assert.equal(await page.evaluate(()=>reply.url===expected),true);
    assert.equal(await page.evaluate(()=>sends),2);
    // No recognized receipt means no result claim, even with a brand new assistant wrapper.
    await page.evaluate(()=>{
      window.reply=null;document.querySelector('button').onclick=()=>{
        sends++;document.querySelector('textarea').value='';
        const history=document.querySelector('#thread');history.replaceWith(history.cloneNode(true));
        const bubble=document.createElement('div');bubble.dataset.messageAuthorRole='assistant';
        const c=document.createElement('canvas');c.width=c.height=256;c.getContext('2d').fillStyle='yellow';c.getContext('2d').fillRect(0,0,256,256);
        const image=new Image();image.src=c.toDataURL();bubble.append(image);document.querySelector('#thread').append(bubble);
      };
      handler({type:'MUSEFLOW_GENERATE',requestId:'unconfirmed-image',prompt:'Create the next portrait image',mediaType:'image',timeoutSec:30},{id:'test'},r=>window.reply=r);
    });
    await page.clock.runFor(8000);
    assert.equal(await page.evaluate(()=>reply===null),true,'A new source URL without the current prompt receipt is not enough');
    await page.evaluate(()=>handler({type:'MUSEFLOW_STOP_GENERATION',requestId:'unconfirmed-image'},{id:'test'},()=>{}));
    await page.clock.runFor(1000);
    assert.equal(await page.evaluate(()=>reply?.ok),false);
    assert.equal(await page.evaluate(()=>sends),3);
    const echoed=await browser.newPage();
    await echoed.route('https://muse.ai/**',r=>r.fulfill({contentType:'text/html',body:'<main><section id="thread"></section><form><textarea placeholder="Message"></textarea><input type="file" accept="image/*"><button type="button" aria-label="Send">Send</button></form></main>'}));
    await echoed.goto('https://muse.ai/echoed-reference');await echoed.clock.install();
    await echoed.evaluate(()=>{
      window.sends=0;window.reply=null;window.progress=[];
      window.chrome={runtime:{id:'test',sendMessage:async m=>progress.push(m.text),onMessage:{addListener:f=>window.handler=f}}};
      const c=document.createElement('canvas');c.width=c.height=447;c.getContext('2d').fillStyle='brown';c.getContext('2d').fillRect(0,0,447,447);window.reference=c.toDataURL();
      c.width=288;c.height=512;c.getContext('2d').fillStyle='cyan';c.getContext('2d').fillRect(0,0,288,512);window.expected=c.toDataURL();
      document.querySelector('input').onchange=()=>{const image=new Image();image.src=reference;document.querySelector('form').append(image);};
      document.querySelector('button').onclick=()=>{
        sends++;const input=document.querySelector('textarea'),receipt=document.createElement('div');receipt.dataset.messageAuthorRole='user';receipt.textContent=input.value;input.value='';document.querySelector('#thread').append(receipt);
        // Same uploaded bytes, fresh URL, separate bubble: DOM role checks alone cannot identify it.
        const echo=document.createElement('div');echo.className='hatch-chat-groupable-bubble';const image=new Image();image.src=URL.createObjectURL(document.querySelector('input').files[0]);echo.append(image);document.querySelector('#thread').append(echo);
        setTimeout(()=>{const reply=document.createElement('div');reply.dataset.messageAuthorRole='assistant';const image=new Image();image.src=expected;reply.append(image);document.querySelector('#thread').append(reply);},10000);
      };
    });
    for(const file of ['composer-controls.js','muse-bridge.js'])await echoed.addScriptTag({path:path.resolve(__dirname,'../'+file)});
    await echoed.evaluate(()=>handler({type:'MUSEFLOW_GENERATE',requestId:'ambiguous-reference',prompt:'Create a portrait from the attached shoe photo',mediaType:'image',referenceImages:[reference],size:'9:16',timeoutSec:30},{id:'test'},r=>window.reply=r));
    for(let i=0;i<50&&!(await echoed.evaluate(()=>sends));i++)await echoed.clock.runFor(200);
    assert.equal(await echoed.evaluate(()=>sends),1);
    await echoed.clock.runFor(8000);
    assert.equal(await echoed.evaluate(()=>reply===null),true,'The uploaded reference bytes must be rejected despite a fresh blob URL and ambiguous role');
    assert.equal(await echoed.evaluate(()=>progress.some(text=>text.includes('bỏ qua ảnh tham chiếu'))),true);
    await echoed.clock.runFor(6000);
    await echoed.waitForFunction(()=>reply!==null,{},{timeout:5000});
    assert.equal(await echoed.evaluate(()=>reply?.ok),true);
    assert.equal(await echoed.evaluate(()=>reply.url===expected),true);
    assert.equal(await echoed.evaluate(()=>sends),1);
    await echoed.close();
    console.log('PASS Muse current-turn association: remounted history and repeated prompts, four sent reference photos, byte-identical references under fresh blob URLs, actual portrait results, unconfirmed sources, stop and one send per request.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
