'use strict';
const path=require('node:path'),fs=require('node:fs');
const NAME='MooZ Agent';
// Keep the existing data/keychain identity when the installer display name changes.
function dataDirectory(appData,initial,exists=file=>fs.existsSync(file)){
 const candidates=[initial,path.join(appData,'Workflow'),path.join(appData,'workflow-museflow'),path.join(appData,'mooz-agent')].filter(Boolean);
 return candidates.find(dir=>exists(path.join(dir,'projects')))||path.join(appData,'workflow-museflow');
}
function distribution(value={}){
 const out={chromeWebStoreURL:null,metaOAuthURL:null,supportURL:'https://github.com/mktminhqpbga-glitch/app-mooz/issues'};
 if(value.chromeWebStoreURL){const u=new URL(value.chromeWebStoreURL);if(u.origin!=='https://chromewebstore.google.com'||!/^\/detail\/[^/]+\/[a-p]{32}$/.test(u.pathname)||u.search||u.hash)throw Error('Địa chỉ Chrome Web Store chưa hợp lệ.');out.chromeWebStoreURL=u.href;}
 if(value.metaOAuthURL){const u=new URL(value.metaOAuthURL);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/')throw Error('Địa chỉ đăng nhập Facebook phải là URL gốc HTTPS.');out.metaOAuthURL=u.href;}
 return out;
}
module.exports={NAME,dataDirectory,distribution};
