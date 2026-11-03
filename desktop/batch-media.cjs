'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const formats={image:{png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',avif:'image/avif'},video:{mp4:'video/mp4',webm:'video/webm',mov:'video/quicktime'},audio:{mp3:'audio/mpeg',wav:'audio/wav',m4a:'audio/mp4',ogg:'audio/ogg'}};
const labels={image:'ảnh',video:'video',audio:'âm thanh'};
class BatchMedia{
 constructor({dialog,files=fs}){this.dialog=dialog;this.files=files;this.pending=null;}
 pick(owner,{kind,maxCount=1}={}){if(!Object.hasOwn(formats,kind)||!Number.isInteger(maxCount)||maxCount<1||maxCount>(kind==='image'?8:1))throw Error('Loại hoặc số tệp đầu vào không hợp lệ.');if(this.pending)return this.pending;this.pending=this.read(owner,kind,maxCount).finally(()=>{this.pending=null;});return this.pending;}
 async read(owner,kind,maxCount){
  const result=await this.dialog.showOpenDialog(owner,{title:'Chọn '+labels[kind]+' cho luồng',buttonLabel:'Chọn tệp',properties:['openFile',...(maxCount>1?['multiSelections']:[])],filters:[{name:labels[kind],extensions:Object.keys(formats[kind])}]});
  if(result.canceled||!result.filePaths?.length)return {canceled:true,files:[],errors:[]};
  if(result.filePaths.length>maxCount)return {canceled:false,files:[],errors:['Chỉ chọn tối đa '+maxCount+' tệp cho đầu vào này.']};
  const files=[],errors=[];let total=0;for(const file of result.filePaths){const name=path.basename(file),mime=formats[kind][path.extname(name).slice(1).toLowerCase()];
   try{if(!mime)throw Error('sai định dạng '+labels[kind]);const stat=await this.files.stat(file),limit=(kind==='image'?20:100)*1024*1024;if(!stat.isFile()||!stat.size||stat.size>limit)throw Error('tệp trống hoặc vượt '+(limit/1024/1024)+' MB');total+=stat.size;if(total>200*1024*1024)return {canceled:false,files:[],errors:['Tổng tệp vượt 200 MB. Chọn ít tệp hơn.']};let data;try{data=await this.files.readFile(file);}catch{throw Error('không đọc được tệp');}if(!data.length||data.length>limit)throw Error('kích thước tệp đã thay đổi; chọn lại');files.push({name,mime,data:data.toString('base64')});}
   catch(error){errors.push(name+': '+(/sai định dạng|tệp trống|không đọc được tệp|kích thước tệp/.test(error.message)?error.message:'không truy cập được tệp'));}
  }return {canceled:false,files,errors};
 }
}
module.exports={BatchMedia};
