'use strict';
const status=document.querySelector('#status'),connect=document.querySelector('#connect'),uri=document.querySelector('#uri');
function show(value){status.textContent=value.error||(value.connected?'Đã kết nối. Trở lại ứng dụng Workflow để chọn các tab AI.':value.state==='connecting'?'Đang kết nối…':'Chưa kết nối.');}
async function update(){try{show(await chrome.runtime.sendMessage({type:'DESKTOP_STATUS'}));}catch{status.textContent='Chưa tải được bộ kết nối. Tải lại tiện ích Workflow rồi mở lại trang này.';}}
connect.onclick=async()=>{connect.disabled=true;status.textContent='Đang kết nối…';try{const result=await chrome.runtime.sendMessage({type:'DESKTOP_CONNECT',uri:uri.value.trim()});show(result);if(result.ok&&result.connected)uri.value='';}catch(error){status.textContent=error.message;}finally{connect.disabled=false;}};
document.querySelector('#disconnect').onclick=async()=>{try{show(await chrome.runtime.sendMessage({type:'DESKTOP_DISCONNECT'}));}catch(error){status.textContent=error.message;}};
void update();setInterval(()=>void update(),3000);
