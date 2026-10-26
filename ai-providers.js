/* Provider adapters. Keys remain in session storage, outside exported workflows. */
(() => {
  const providers = {
    muse: {name:'Muse.ai · tab', types:['text','image','video'], urls:['https://muse.ai/*','https://*.muse.ai/*']},
    chatgpt: {name:'ChatGPT · tab', types:['text','image'], urls:['https://chatgpt.com/*','https://www.chatgpt.com/*','https://chat.openai.com/*']},
    gemini: {name:'Gemini · tab', types:['text','image'], urls:['https://gemini.google.com/*']},
    google: {name:'Google Gemini / Veo · API', types:['text','image','video']},
    openai: {name:'OpenAI · API', types:['text','image']},
    fal: {name:'fal.ai Kling Motion Control · API', types:['video']}
  };
  const models = {google:{text:'gemini-2.5-flash',image:'gemini-2.5-flash-image',video:'veo-3.0-generate-001'},openai:{text:'gpt-4.1-mini',image:'gpt-image-1'},fal:{video:'fal-ai/kling-video/v2.6/standard/motion-control'}};
  const abort = signal => {if(signal?.aborted)throw new DOMException('Đã dừng tạo nội dung.','AbortError');};
  const sleep = (ms,signal) => new Promise((resolve,reject)=>{abort(signal);const cancel=()=>{clearTimeout(timer);reject(new DOMException('Đã dừng.','AbortError'));};const timer=setTimeout(()=>{signal?.removeEventListener('abort',cancel);resolve();},ms);signal?.addEventListener('abort',cancel,{once:true});});
  async function json(url,options={}) {
    const r=await fetch(url,{...options,redirect:'error'});
    if(!r.ok)throw new Error(`API trả về HTTP ${r.status}. Kiểm tra khóa, quyền model, hạn mức và đầu vào.`);
    return r.json();
  }
  async function media(url,signal) {
    const r=await fetch(url,{signal});if(!r.ok)throw new Error('Không đọc được tệp tham chiếu.');const blob=await r.blob();
    if(!/^(image|video)\//.test(blob.type))throw new Error('Tệp API phải là ảnh hoặc video có MIME hợp lệ.');
    if(!blob.size||blob.size>20*1024*1024)throw new Error('Tệp API phải có dung lượng từ 1 byte đến 20 MB.');
    const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});
    return {mimeType:blob.type,data:String(data).split(',')[1],dataUrl:data};
  }
  function validate(provider,r) {
    if(!providers[provider]?.types.includes(r.mediaType))throw new Error('AI này không hỗ trợ loại đầu ra đã chọn.');
    if(r.referenceVideos?.length&&provider==='openai')throw new Error('OpenAI adapter chưa hỗ trợ video gốc. Chọn Gemini để phân tích video.');
    if(r.mediaType==='video'&&provider==='google'&&r.referenceVideos?.length)throw new Error('Veo adapter chưa hỗ trợ Motion Control. Chọn fal.ai.');
    if(r.mediaType==='video'&&provider==='google'&&(r.referenceImages||[]).length>1)throw new Error('Veo adapter chỉ nhận một ảnh khởi đầu.');
    if(r.mediaType==='video'&&provider==='google'&&![4,6,8].includes(Number(r.duration)))throw new Error('Veo adapter hỗ trợ clip 4, 6 hoặc 8 giây; không thể bảo đảm một clip 15–60 giây.');
    if(provider==='fal'&&(!r.referenceImages?.length||r.referenceVideos?.length!==1))throw new Error('Motion Control cần ảnh nhân vật và đúng một video chuyển động gốc.');
    if(provider==='fal'&&r.referenceImages.length!==1)throw new Error('Motion Control nhận đúng một ảnh nhân vật.');
  }
  async function api(provider,r,key,signal) {
    validate(provider,r);if(!key)throw new Error('Chưa nhập API key trong Cài đặt.');abort(signal);
    const model=r.model||models[provider]?.[r.mediaType];
    if(provider==='google') {
      const base='https://generativelanguage.googleapis.com/v1beta/';
      const headers={'Content-Type':'application/json','x-goog-api-key':key};
      const parts=[{text:[r.rules,r.prompt].filter(Boolean).join('\n\n')}];
      for(const url of [...(r.referenceImages||[]),...(r.referenceVideos||[])]) {const {mimeType,data}=await media(url,signal);parts.push({inlineData:{mimeType,data}});}
      if(r.mediaType!=='video') {
        const body={contents:[{role:'user',parts}],...(r.mediaType==='image'?{generationConfig:{responseModalities:['TEXT','IMAGE']}}:{})};
        const result=await json(`${base}models/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers,body:JSON.stringify(body),signal});
        const out=result.candidates?.[0]?.content?.parts||[];
        const text=out.map(p=>p.text||'').join('\n');const img=out.find(p=>p.inlineData?.mimeType?.startsWith('image/'))?.inlineData;
        if(r.mediaType==='text'&&!text)throw new Error('Gemini không trả về văn bản.');
        if(r.mediaType==='image'&&!img)throw new Error('Model không trả về ảnh. Kiểm tra quyền model tạo ảnh.');
        return {ok:true,text,url:img?`data:${img.mimeType};base64,${img.data}`:undefined};
      }
      if(r.referenceVideos?.length)throw new Error('Veo adapter chưa hỗ trợ Motion Control. Chọn fal.ai.');
      if((r.referenceImages||[]).length>1)throw new Error('Veo adapter chỉ nhận một ảnh khởi đầu.');
      const instance={prompt:r.prompt};if(r.referenceImages?.length){const image=await media(r.referenceImages[0],signal);instance.image={bytesBase64Encoded:image.data,mimeType:image.mimeType};}
      let operation=await json(`${base}models/${encodeURIComponent(model)}:predictLongRunning`,{method:'POST',headers,body:JSON.stringify({instances:[instance],parameters:{aspectRatio:r.size||'16:9',durationSeconds:Number(r.duration)}}),signal});
      const end=Date.now()+600000;
      while(!operation.done&&Date.now()<end){await sleep(4000,signal);if(!/^models\/[\w.-]+\/operations\/[\w.-]+$/.test(operation.name||''))throw new Error('Mã tác vụ Veo không hợp lệ.');operation=await json(base+operation.name,{headers,signal});}
      if(!operation.done)throw new Error('Veo chưa hoàn tất sau 10 phút.');if(operation.error)throw new Error('Tác vụ Veo thất bại.');
      const uri=operation.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
      if(!uri||new URL(uri).origin!=='https://generativelanguage.googleapis.com')throw new Error('Veo không trả về video có thể tải an toàn.');
      const video=await fetch(uri,{headers:{'x-goog-api-key':key},signal,redirect:'error'});if(!video.ok)throw new Error('Không tải được video Veo.');
      return {ok:true,url:URL.createObjectURL(await video.blob())};
    }
    if(provider==='openai') {
      const headers={'Content-Type':'application/json',Authorization:`Bearer ${key}`};
      if(r.mediaType==='image') {
        if(r.referenceImages?.length)throw new Error('OpenAI adapter tạo ảnh chưa hỗ trợ ảnh tham chiếu; chọn Gemini hoặc tab AI.');
        const result=await json('https://api.openai.com/v1/images/generations',{method:'POST',headers,signal,body:JSON.stringify({model,prompt:r.prompt,n:1,size:r.size==='16:9'?'1536x1024':r.size==='9:16'?'1024x1536':'1024x1024'})});
        const image=result.data?.[0];if(!image?.b64_json&&!image?.url)throw new Error('OpenAI không trả về ảnh.');return {ok:true,url:image.b64_json?`data:image/png;base64,${image.b64_json}`:image.url};
      }
      const content=[{type:'input_text',text:r.prompt}];for(const url of r.referenceImages||[])content.push({type:'input_image',image_url:(await media(url,signal)).dataUrl});
      const result=await json('https://api.openai.com/v1/responses',{method:'POST',headers,signal,body:JSON.stringify({model,instructions:r.rules||undefined,input:[{role:'user',content}]})});
      const text=(result.output||[]).flatMap(item=>item.content||[]).filter(item=>item.type==='output_text').map(item=>item.text).join('\n');if(!text)throw new Error('OpenAI không trả về văn bản.');return {ok:true,text};
    }
    if(provider==='fal') {
      if(!/^fal-ai\/[a-zA-Z0-9/_.-]+$/.test(model)||model.includes('..'))throw new Error('Model fal.ai không hợp lệ.');
      const image=(await media(r.referenceImages[0],signal)).dataUrl,video=(await media(r.referenceVideos[0],signal)).dataUrl;
      const headers={'Content-Type':'application/json',Authorization:`Key ${key}`};
      const task=await json(`https://queue.fal.run/${model}`,{method:'POST',headers,signal,body:JSON.stringify({prompt:r.prompt,image_url:image,video_url:video,character_orientation:'video',keep_original_sound:true})});
      for(const url of [task.status_url,task.response_url,task.cancel_url].filter(Boolean))if(new URL(url).origin!=='https://queue.fal.run')throw new Error('Địa chỉ tác vụ fal.ai không hợp lệ.');
      const cancel=()=>{if(task.cancel_url)void fetch(task.cancel_url,{method:'PUT',headers}).catch(()=>{});};signal?.addEventListener('abort',cancel,{once:true});
      try {const end=Date.now()+600000;while(Date.now()<end){abort(signal);const status=await json(task.status_url,{headers,signal});if(status.status==='COMPLETED'){const result=await json(task.response_url,{headers,signal});if(!result.video?.url)throw new Error('fal.ai không trả về video.');return {ok:true,url:result.video.url};}if(status.status==='FAILED')throw new Error('fal.ai tạo video thất bại.');await sleep(4000,signal);}throw new Error('fal.ai chưa hoàn tất sau 10 phút.');}finally{signal?.removeEventListener('abort',cancel);}
    }
  }
  globalThis.WorkflowAI={providers,models,validate,api};
})();
