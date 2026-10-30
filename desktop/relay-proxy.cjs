'use strict';
const {HttpsProxyAgent}=require('https-proxy-agent'),{getProxyForUrl}=require('proxy-from-env');
async function relaySocketOptions(endpoint,{resolveProxy,environmentProxy=getProxyForUrl}={}){
 const url=new URL(endpoint);url.protocol='https:';let proxy=environmentProxy(url.href);
 if(!proxy&&resolveProxy){const first=String(await resolveProxy(url.href)).split(';')[0].trim();if(first==='DIRECT')return {};const m=/^(PROXY|HTTPS) ([^\s]+)$/.exec(first);if(!m)throw Error('Proxy hệ thống chưa được hỗ trợ cho relay. Chưa chuyển sang kết nối trực tiếp.');proxy=(m[1]==='HTTPS'?'https://':'http://')+m[2];}
 if(!proxy)return {};let parsed;try{parsed=new URL(proxy);}catch{throw Error('Cấu hình proxy relay không hợp lệ.');}if(!['http:','https:'].includes(parsed.protocol))throw Error('Loại proxy này chưa được hỗ trợ cho relay.');return {agent:new HttpsProxyAgent(parsed)};
}
module.exports={relaySocketOptions};
