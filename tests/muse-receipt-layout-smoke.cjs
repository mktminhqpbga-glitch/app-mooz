const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  try{
    const page=await browser.newPage();
    await page.route('https://muse.ai/**',r=>r.fulfill({contentType:'text/html',body:'<main><section id="thread"></section><section id="composer"><textarea placeholder="Message"></textarea><div data-testid="hatch-composer-placeholder-overlay"><span></span></div><button type="button" aria-label="Send">Send</button></section></main>'}));
    await page.goto('https://muse.ai/receipt-layout');await page.clock.install();
    await page.evaluate(()=>{
      window.sent=0;window.result=null;window.chrome={runtime:{id:'test',sendMessage:async()=>{},onMessage:{addListener:f=>window.handler=f}}};
      const c=document.createElement('canvas');c.width=288;c.height=512;c.getContext('2d').fillStyle='purple';c.getContext('2d').fillRect(0,0,288,512);window.expected=c.toDataURL();
      document.querySelector('textarea').oninput=e=>document.querySelector('[data-testid="hatch-composer-placeholder-overlay"] span').textContent=e.target.value;
      document.querySelector('button').onclick=()=>{
        sent++;const editor=document.querySelector('textarea'),user=document.createElement('div');user.dataset.messageAuthorRole='user';user.style.display='contents';user.append(document.createTextNode(editor.value));
        const name=document.createElement('span');name.textContent=' workflow-reference-01-original-product-image-with-a-long-filename.jpg';user.append(name);document.querySelector('#thread').append(user);editor.value='';document.querySelector('[data-testid="hatch-composer-placeholder-overlay"] span').textContent='';
        const reply=document.createElement('div');reply.dataset.testid='hatch-chat-attachment-presentation-image';const contents=document.createElement('span');contents.style.display='contents';const bubble=document.createElement('button');bubble.type='button';bubble.className='hatch-chat-groupable-bubble';bubble.setAttribute('aria-busy','false');const image=new Image();image.src=expected;bubble.append(image);contents.append(bubble);reply.append(contents);document.querySelector('#thread').append(reply);
      };
    });
    for(const file of ['composer-controls.js','muse-bridge.js'])await page.addScriptTag({path:path.resolve(__dirname,'../'+file)});
    await page.evaluate(()=>handler({type:'MUSEFLOW_GENERATE',requestId:'composer-overlay',prompt:'Create this next portrait image',mediaType:'image',size:'9:16',timeoutSec:30},{id:'test'},r=>window.result=r));
    await page.clock.runFor(8000);
    assert.equal(await page.evaluate(()=>result?.ok),true,'Composer mirror is not a historical receipt and user attachment filenames must not hide the real receipt');
    assert.equal(await page.evaluate(()=>result.url===expected),true);
    assert.equal(await page.evaluate(()=>sent),1);
    console.log('PASS Muse receipt layout: ignore composer text mirrors, recognize user prompt with long attachment labels, return only the current portrait and send once.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
