'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const TYPES={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.avif':'image/avif','.gif':'image/gif'};
const MAX_IMAGE=20*1024*1024,MAX_TOTAL=200*1024*1024;
class BatchImages{
 constructor({dialog,files=fs}){this.dialog=dialog;this.files=files;this.pending=null;}
 pick(owner,{purpose='product'}={}){if(this.pending)return this.pending;this.pending=this.readSelection(owner,purpose).finally(()=>{this.pending=null;});return this.pending;}
 async readSelection(owner,purpose){
  const character=purpose==='character';
  const result=await this.dialog.showOpenDialog(owner,{title:character?'Chọn ảnh nhân vật tham chiếu':'Chọn ảnh sản phẩm',buttonLabel:'Thêm ảnh',properties:character?['openFile']:['openFile','multiSelections'],filters:[{name:character?'Ảnh nhân vật':'Ảnh sản phẩm',extensions:['png','jpg','jpeg','webp','avif','gif']}]});
  if(result.canceled||!result.filePaths?.length)return {canceled:true,files:[],errors:[]};
  if(character&&result.filePaths.length>1)return {canceled:false,files:[],errors:['Mỗi luồng dùng một ảnh nhân vật. Chọn lại một ảnh.']};
  if(result.filePaths.length>100)return {canceled:false,files:[],errors:['Mỗi lượt tối đa 100 ảnh. Chọn ít ảnh hơn rồi thử lại.']};
  const files=[],errors=[];let total=0;
  for(const file of result.filePaths){const name=path.basename(file),mime=TYPES[path.extname(file).toLowerCase()];
   if(!mime){errors.push(name+': chỉ hỗ trợ JPG, PNG, WebP, AVIF và GIF.');continue;}
   try{const stat=await this.files.stat(file);if(!stat.isFile()||!stat.size||stat.size>MAX_IMAGE){errors.push(name+': ảnh trống hoặc vượt 20 MB.');continue;}
    if(total+stat.size>MAX_TOTAL)return {canceled:false,files:[],errors:['Tổng ảnh trong một lượt vượt 200 MB. Chọn ít ảnh hơn rồi thử lại.']};
    const data=await this.files.readFile(file);if(!data.length||data.length>MAX_IMAGE||total+data.length>MAX_TOTAL){errors.push(name+': dung lượng ảnh đã thay đổi, hãy chọn lại.');continue;}
    total+=data.length;files.push({name,mime,data:data.toString('base64')});
   }catch{errors.push(name+': không đọc được ảnh. Kiểm tra quyền truy cập hoặc chọn lại tệp.');}
  }
  return {canceled:false,files,errors};
 }
}
module.exports={BatchImages};
