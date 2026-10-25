/* Real isolated Electron bridge; AI pages below are local DOM fixtures. */
const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
(async()=>{
 const data=await fs.mkdtemp(path.join(os.tmpdir(),'workflow-ai-results-'));let application;
 try{
  const env={...process.env,WORKFLOW_DESKTOP_TEST:'1',WORKFLOW_TEST_DATA:data};delete env.ELECTRON_RUN_AS_NODE;
  application=await electron.launch({args:['--no-sandbox',...(process.platform==='linux'&&!env.DISPLAY?['--ozone-platform=headless','--disable-gpu']:[]),path.resolve(__dirname,'..')],env,timeout:60000});
  const home=await application.firstWindow();await home.waitForSelector('#newProject');
  await application.evaluate(async({session})=>{
   for(const provider of ['gemini','chatgpt'])await session.fromPartition('persist:workflow-ai-'+provider).protocol.handle('https',()=>new Response(`<!doctype html><main><div ${provider==='gemini'?'class="model-response"':'data-turn="assistant"'}>Old answer</div></main><form><textarea placeholder="Message" ${provider==='chatgpt'?'id="prompt-textarea"':''}></textarea><button type="button" aria-label="Send">Send</button></form><script>
    window.sent=0;window.kind='text';
    document.querySelector('button').onclick=()=>{
     sent++;const editor=document.querySelector('textarea'),user=document.createElement('${provider==='gemini'?'user-query':'article'}');user.dataset.turn='user';user.textContent=editor.value;editor.value='';document.querySelector('main').append(user);
     if(sent===1)history.pushState({},'','${provider==='gemini'?'/app/created':'/c/created'}');
     const reply=document.createElement('div');reply.className='model-response';reply.dataset.turn='assistant';reply.setAttribute('data-is-streaming','true');document.querySelector('main').append(reply);
     setTimeout(()=>{if(kind==='image'){const c=document.createElement('canvas');c.width=288;c.height=512;c.getContext('2d').fillStyle='blue';c.getContext('2d').fillRect(0,0,288,512);const img=new Image();img.src=c.toDataURL();window.expected=img.src;reply.append(img);}else reply.innerHTML='<div class="markdown">First complete block.</div><div class="markdown">Second complete block.</div>';reply.removeAttribute('data-is-streaming');},200);
    };
   </script>`,{headers:{'content-type':'text/html'}}));
  });
  for(const provider of ['gemini','chatgpt']){
   const promise=application.waitForEvent('window');
   const tab=await application.evaluate((_,provider)=>globalThis.workflowTest.ai.open(provider),provider);const page=await promise;await page.waitForSelector('textarea');
   await application.evaluate(async(_,id)=>{const t=globalThis.workflowTest;await t.ai.script(id,['ai-activity.js','composer-controls.js','ai-bridge.js'],null,null);},tab.id);
   for(const kind of ['text','image']){
    await page.evaluate(kind=>window.kind=kind,kind);
    const result=await application.evaluate(async(_,{id,kind,provider})=>globalThis.workflowTest.ai.message(id,{type:'WORKFLOW_AI_GENERATE',requestId:provider+'-'+kind,prompt:'Return only the current requested result.',mediaType:kind},null),{id:tab.id,kind,provider});
    assert.equal(result.ok,true,JSON.stringify(result));
    if(kind==='text')assert.equal(result.text,'First complete block.\n\nSecond complete block.');else assert.equal(result.url,await page.evaluate(()=>expected));
   }
   assert.equal(await page.evaluate(()=>sent),2);const check=await application.evaluate(async(_,id)=>globalThis.workflowTest.ai.message(id,{type:'WORKFLOW_AI_CHECK'},null),tab.id);assert.equal(check.resultProtocol,3);assert.equal(check.busy,false);
   await page.close();console.log('PASS Electron '+provider+': new conversation URL, complete multi-block text and current image bytes, request isolation, protocol 3.');
  }
 }finally{await application?.close();await fs.rm(data,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
