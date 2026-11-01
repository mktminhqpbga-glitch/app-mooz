/* One active Muse tab per background window. Never focuses an OS window. */
(()=>{
 const KEY='workflowMuseBackground',pending=new Map(),owned=new Set();let enabled=true,lastError='';
 const muse=tab=>globalThis.WorkflowAISites?.providerForURL(tab?.url)==='muse';
 const ready=chrome.storage.local.get(KEY).then(s=>{if(typeof s[KEY]==='boolean')enabled=s[KEY];}).catch(()=>{});
 const snapshot=()=>({enabled,preparedWindows:owned.size,error:lastError});
 async function prepare(id){await ready;if(!enabled)return {prepared:false,enabled:false};if(pending.has(id))return pending.get(id);
  const task=(async()=>{try{
   if(!Number.isInteger(id))throw Error('Chọn tab Muse hợp lệ.');
   const tab=await chrome.tabs.get(id);if(!muse(tab))throw Error('Chỉ chuẩn bị cửa sổ nền cho tab Muse.');
   const win=await chrome.windows.get(tab.windowId,{populate:true});
   if(win.state!=='minimized'&&win.tabs?.length===1&&tab.active){lastError='';return {prepared:true,windowId:win.id,tabId:id};}
   const created=await chrome.windows.create({tabId:id,type:'normal',focused:false,state:'normal',width:1050,height:820});
   owned.add(created.id);const current=await chrome.tabs.get(id);
   if(!muse(current)||current.windowId!==created.id||!current.active)throw Error('Tab Muse đã đổi trong lúc chuẩn bị. Kiểm tra cửa sổ; chưa gửi yêu cầu.');
   lastError='';return {prepared:true,windowId:created.id,tabId:id};
  }catch(e){lastError='Chưa chuẩn bị được cửa sổ Muse nền: '+e.message;throw Error(lastError);}})();pending.set(id,task);try{return await task;}finally{pending.delete(id);}
 }
 async function configure(value){await ready;if(typeof value!=='boolean')throw Error('Lựa chọn chạy nền không hợp lệ.');await chrome.storage.local.set({[KEY]:value});enabled=value;lastError='';return snapshot();}
 async function prepareAll(){await ready;if(!enabled)throw Error('Bật Giữ Muse chạy nền trước.');const tabs=(await chrome.tabs.query({})).filter(muse),results=await Promise.allSettled(tabs.map(t=>prepare(t.id)));return {...snapshot(),prepared:results.filter(r=>r.status==='fulfilled').length,failed:results.filter(r=>r.status==='rejected').length,total:tabs.length};}
 chrome.windows.onRemoved?.addListener(id=>owned.delete(id));
 globalThis.WorkflowMuseBackground={prepare,configure,prepareAll,snapshot,ready};
})();
