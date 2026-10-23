'use strict';
const fs=require('node:fs');
const path=require('node:path');
function setVersion(root,version){
  if(!/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(version||''))throw Error('Nhập version dạng 0.31.1, không thêm chữ v.');
  if(version.split('.').some(part=>!Number.isSafeInteger(Number(part))||Number(part)>65535))throw Error('Mỗi phần version cần nằm trong khoảng 0–65535.');
  const read=name=>fs.readFileSync(path.join(root,name),'utf8');
  const pkg=JSON.parse(read('package.json')),lock=JSON.parse(read('package-lock.json')),manifest=JSON.parse(read('manifest.json'));
  const previous=pkg.version;
  const before=previous.split('.').map(Number),after=version.split('.').map(Number);
  for(let i=0;i<3;i++){if(after[i]>before[i])break;if(after[i]<before[i])throw Error('Version mới không được thấp hơn version hiện tại.');}
  const textFiles=['app.html','muse-bridge.js','desktop/preload.cjs','README.md'];
  const texts=Object.fromEntries(textFiles.map(name=>[name,read(name)]));
  const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  pkg.version=version;lock.version=version;
  if(!lock.packages?.[''])throw Error('Lockfile không có thông tin package gốc. Chưa thay đổi tệp nào.');
  lock.packages[''].version=version;manifest.version=version;
  const pending={'package.json':JSON.stringify(pkg,null,2)+'\n','package-lock.json':JSON.stringify(lock,null,2)+'\n','manifest.json':JSON.stringify(manifest,null,2)+'\n'};
  for(const [name,text]of Object.entries(texts))pending[name]=name==='README.md'?text.replace(/^# Workflow · MuseFlow .*$/m,'# Workflow · MuseFlow '+version):text.replace(new RegExp(escape(previous),'g'),version);
  for(const [name,text]of Object.entries(pending))fs.writeFileSync(path.join(root,name),text);
  return version;
}
if(require.main===module){try{console.log('Đã cập nhật version: '+setVersion(path.resolve(__dirname,'..'),process.argv[2]));}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={setVersion};
